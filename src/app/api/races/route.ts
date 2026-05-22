export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMockRaces } from '@/services/jravan/mock'
import { getMockAiComment } from '@/services/ai/mock'
import { enrichHorses, generatePicks, calcRaceScoreWithContext, buildMarketDivergenceResult } from '@/lib/calculator'
import { optimizeBets } from '@/lib/betOptimizer'
import { computeLearningModel } from '@/lib/learningModel'
import type { LearningBetInput } from '@/lib/learningModel'
import type { LearningModel } from '@/types'
import { calculateAIScore } from '@/lib/scoreUtils'
import { getCourseFeature } from '@/services/course/courseProfiles'
import { buildPacePrediction } from '@/services/pace/pacePrediction'
import { buildTrackConditionResult } from '@/services/track/trackCondition'
import { buildGateTendencyResult } from '@/services/gate/gateTendency'
import { Race, Surface, TrackCondition, RunningStyle } from '@/types'
import { prisma } from '@/lib/prisma'
import { popularityRangeLabel, aiScoreRangeLabel } from '@/lib/learningSegments'

type PastResult = { venue: string; distance: number; surface: Surface; position: number; total: number }
type RawHorse = {
  number: number; gate: number; name: string; jockey: string; trainer: string
  age: number; sex: string; winOdds: number; placeOddsMin: number; placeOddsMax: number
  popularity: number; style: RunningStyle; pastResults: PastResult[]
}
type RawRace = {
  id: string; date: string; venue: string; raceNumber: number; raceName: string
  distance: number; surface: Surface; grade: string; trackCondition: TrackCondition; horses: RawHorse[]
}
type StatRow = {
  venue: string; surface: string; distance: number; betType: string
  popularityRange: string; aiScoreRange: string; returnRateBonus: number
}

function getHorseBonus(
  horse: { popularity: number; aiScore: number },
  venue: string,
  surface: string,
  stats: StatRow[]
): { bonus: number; reason: string } {
  const pr  = popularityRangeLabel(horse.popularity)
  const asr = aiScoreRangeLabel(horse.aiScore)
  const matches: { bonus: number; label: string }[] = []

  for (const s of stats) {
    const isVenueOnly   = s.venue === venue  && s.surface === '' && s.betType === '' && s.popularityRange === '' && s.aiScoreRange === ''
    const isSurfaceOnly = s.venue === ''     && s.surface === surface && s.betType === '' && s.popularityRange === '' && s.aiScoreRange === ''
    const isPopOnly     = s.venue === ''     && s.surface === '' && s.betType === '' && s.popularityRange === pr  && s.aiScoreRange === '' && !!pr
    const isAiOnly      = s.venue === ''     && s.surface === '' && s.betType === '' && s.popularityRange === '' && s.aiScoreRange === asr
    const isVenueSurf   = s.venue === venue  && s.surface === surface && s.betType === '' && s.popularityRange === '' && s.aiScoreRange === ''

    if (isVenueOnly)   matches.push({ bonus: s.returnRateBonus, label: `${venue}実績` })
    if (isSurfaceOnly) matches.push({ bonus: s.returnRateBonus, label: `${surface}実績` })
    if (isPopOnly)     matches.push({ bonus: s.returnRateBonus, label: `${pr}実績` })
    if (isAiOnly)      matches.push({ bonus: s.returnRateBonus, label: `AIスコア${asr}帯実績` })
    if (isVenueSurf)   matches.push({ bonus: s.returnRateBonus, label: `${venue}×${surface}実績` })
  }

  if (matches.length === 0) return { bonus: 0, reason: '' }
  const bonus  = Math.round(matches.reduce((s, m) => s + m.bonus, 0) / matches.length)
  const reason = matches.filter(m => m.bonus !== 0).map(m => m.label).join(' / ')
  return { bonus, reason }
}

function buildRaces(rawRaces: RawRace[], learningModel: LearningModel, learningStats: StatRow[]): Race[] {
  return rawRaces.map(raw => {
    // Step 1: 初期スコアリング（人気ベースのwinRate使用）
    const baseHorses = enrichHorses(raw.horses)

    // Step 2: コース・展開・馬場・枠順コンテキスト生成
    const courseFeature = getCourseFeature(raw.venue, raw.surface, raw.distance)
    const pacePrediction = buildPacePrediction(baseHorses, courseFeature)
    const trackConditionResult = buildTrackConditionResult(raw.trackCondition, raw.surface)
    const gateTendencyResult = buildGateTendencyResult(raw.venue, raw.surface, raw.distance, baseHorses)

    // Step 3: コンテキスト込みAIスコア適用（展開・枠・馬場・人気補正）
    const scoreContext = {
      pacePrediction,
      gateTendencyResult,
      trackCondition: raw.trackCondition,
      surface: raw.surface,
    }
    const scoredHorses = baseHorses.map(h => {
      const { aiScore, marketLabel, aiComment } = calculateAIScore(h, scoreContext)
      return { ...h, aiScore, marketLabel, aiComment }
    })

    // Step 4: aiScoreで再ランク付け・divergenceScore更新
    const sortedByAi = [...scoredHorses].sort((a, b) => b.aiScore - a.aiScore)
    const aiRankMap = new Map(sortedByAi.map((h, i) => [h.name, i + 1]))
    const horsesWithRank = scoredHorses.map(h => {
      const aiRank = aiRankMap.get(h.name) ?? scoredHorses.length
      return { ...h, aiRank, divergenceScore: h.popularity - aiRank }
    })

    // Step 4.5: LearningStat 補正を aiScore に加算
    const horses = horsesWithRank.map(h => {
      const { bonus, reason } = getHorseBonus(h, raw.venue, raw.surface, learningStats)
      const rawAiScore = h.aiScore
      if (bonus === 0) return { ...h, rawAiScore, aiScoreBonus: 0, aiScoreBonusReason: '' }
      const aiScore = Math.max(-100, Math.min(100, rawAiScore + bonus))
      return { ...h, aiScore, rawAiScore, aiScoreBonus: bonus, aiScoreBonusReason: reason }
    })

    // Step 5: 最終的な市場乖離・レース・ピック生成
    const marketDivergenceResult = buildMarketDivergenceResult(horses)
    const raceBase: Race = { ...raw, horses, picks: [], aiComment: '', overallEvScore: 0 }
    const raceWithGate: Race = { ...raceBase, gateTendencyResult }
    const picks = generatePicks(raceWithGate, pacePrediction)
    const overallEvScore = calcRaceScoreWithContext(
      horses, raw.venue, raw.surface, pacePrediction, courseFeature, raw.trackCondition, gateTendencyResult
    )
    const aiComment = getMockAiComment({
      ...raceBase, picks, overallEvScore, courseFeature, pacePrediction,
      trackCondition: raw.trackCondition, trackConditionResult, gateTendencyResult, marketDivergenceResult,
    })
    const optimizedBets = optimizeBets(horses, {
      pacePrediction,
      trackConditionResult,
      venue: raw.venue,
      surface: raw.surface,
      trackCondition: raw.trackCondition,
      learningModel,
    })
    return {
      ...raceBase, picks, aiComment, overallEvScore,
      courseFeature, pacePrediction,
      trackCondition: raw.trackCondition, trackConditionResult, gateTendencyResult, marketDivergenceResult,
      optimizedBets,
    }
  })
}

const VALID_SURFACES: Surface[] = ['芝', 'ダート']
const VALID_CONDITIONS: TrackCondition[] = ['良', '稍重', '重', '不良']
const VALID_STYLES: RunningStyle[] = ['逃げ', '先行', '差し', '追込']

function toSurface(v: string): Surface {
  return VALID_SURFACES.includes(v as Surface) ? (v as Surface) : '芝'
}
function toCondition(v: string): TrackCondition {
  return VALID_CONDITIONS.includes(v as TrackCondition) ? (v as TrackCondition) : '良'
}
function toStyle(v: string): RunningStyle {
  return VALID_STYLES.includes(v as RunningStyle) ? (v as RunningStyle) : '先行'
}

export async function GET() {
  try {
    const [importedCount, allBets, learningStats] = await Promise.all([
      prisma.importedRace.count(),
      prisma.bet.findMany(),
      prisma.learningStat.findMany({
        select: { venue: true, surface: true, distance: true, betType: true, popularityRange: true, aiScoreRange: true, returnRateBonus: true },
      }),
    ])
    const learningModel = computeLearningModel(allBets as unknown as LearningBetInput[])

    let rawRaces: RawRace[]

    if (importedCount > 0) {
      // CSV取込データを優先使用
      const imported = await prisma.importedRace.findMany({
        include: { horses: { orderBy: { horseNumber: 'asc' } } },
        orderBy: [{ raceDate: 'desc' }, { raceNumber: 'asc' }],
      })

      rawRaces = imported.map(r => ({
        id: `csv-${r.raceDate}-${r.racecourse}-${r.raceNumber}`,
        date: r.raceDate,
        venue: r.racecourse,
        raceNumber: r.raceNumber,
        raceName: r.raceName,
        distance: r.distance,
        surface: toSurface(r.surface),
        grade: '',
        trackCondition: toCondition(r.trackCondition),
        horses: r.horses.map(h => ({
          number: h.horseNumber,
          gate: h.frameNumber,
          name: h.horseName,
          jockey: '',
          trainer: '',
          age: 0,
          sex: '',
          winOdds: h.odds,
          placeOddsMin: Math.round(h.odds * 0.25 * 10) / 10,
          placeOddsMax: Math.round(h.odds * 0.5 * 10) / 10,
          popularity: h.popularity,
          style: toStyle(h.runningStyle),
          pastResults: [],
        })),
      }))
    } else {
      // フォールバック: モックデータを使用
      rawRaces = getMockRaces() as unknown as RawRace[]
    }

    const races = buildRaces(rawRaces, learningModel, learningStats)
    races.sort((a, b) => b.overallEvScore - a.overallEvScore)
    return NextResponse.json({ races })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
