import { Horse, Pick, Race, Surface, PacePrediction, CourseFeature, TrackCondition, GateTendencyResult, MarketLabel, HorseDivergence, MarketDivergenceResult } from '@/types'
import { calcCourseStyleBonus } from '@/services/course/courseProfiles'
import { calcPaceEvBonus } from '@/services/pace/pacePrediction'
import { calcTrackConditionEvBonus } from '@/services/track/trackCondition'

// JRA統計ベースの人気別推定勝率（過去実績がない馬向け）
const POPULARITY_WIN_RATES: Record<number, number> = {
  1: 0.330, 2: 0.186, 3: 0.127, 4: 0.091, 5: 0.068, 6: 0.052,
}

export function estimateWinRate(horse: Horse): number {
  const recent = horse.pastResults.slice(0, 5)
  if (recent.length === 0) {
    // 過去実績なし（CSV馬など）: 人気順から推定
    return POPULARITY_WIN_RATES[horse.popularity] ?? Math.max(0.02, 0.05 - (horse.popularity - 6) * 0.005)
  }

  const score = recent.reduce((sum, r) => {
    if (r.position === 1) return sum + 1.0
    if (r.position === 2) return sum + 0.4
    if (r.position === 3) return sum + 0.2
    return sum
  }, 0)

  const baseRate = score / recent.length
  const popularityAdj = Math.max(0.5, 1 - (horse.popularity - 1) * 0.025)
  return Math.max(0.02, Math.min(0.90, baseRate * popularityAdj))
}

export function calcEvScore(winOdds: number, winRate: number): number {
  const ev = winOdds * winRate - 1
  return Math.round(Math.max(-100, Math.min(100, ev * 100)))
}

export function calcSkewScore(winOdds: number, winRate: number): number {
  const marketRate = 1 / winOdds
  const diff = (winRate - marketRate) * 100
  return Math.round(Math.max(-60, Math.min(60, diff)))
}

export function getMarketLabel(aiRank: number, popularity: number, evScore: number): MarketLabel {
  const diff = popularity - aiRank
  if (diff >= 3) return '過小評価'
  if (diff <= -3) return '危険人気馬'
  if (evScore > 0 && popularity >= 4) return '妙味あり'
  if (aiRank <= 2 && popularity <= 2) return '本命候補'
  return '標準'
}

export function enrichHorses(horses: Omit<Horse, 'winRate' | 'evScore' | 'skewScore' | 'aiRank' | 'divergenceScore' | 'marketLabel' | 'aiScore' | 'aiComment'>[]): Horse[] {
  const withScores = horses.map(h => {
    const winRate = estimateWinRate(h as Horse)
    return {
      ...h,
      winRate,
      evScore: calcEvScore(h.winOdds, winRate),
      skewScore: calcSkewScore(h.winOdds, winRate),
    }
  })

  const sortedByEv = [...withScores].sort((a, b) => b.evScore - a.evScore)
  const rankMap = new Map(sortedByEv.map((h, i) => [h.name, i + 1]))

  return withScores.map(h => {
    const aiRank = rankMap.get(h.name) ?? withScores.length
    const divergenceScore = h.popularity - aiRank
    const marketLabel = getMarketLabel(aiRank, h.popularity, h.evScore)
    // aiScore starts as evScore; context bonuses applied later in races/route.ts
    return { ...h, aiRank, divergenceScore, marketLabel, aiScore: h.evScore, aiComment: '' } as Horse
  })
}

export function buildMarketDivergenceResult(horses: Horse[]): MarketDivergenceResult {
  const allHorses: HorseDivergence[] = horses
    .map(h => ({
      name: h.name,
      aiRank: h.aiRank,
      popularity: h.popularity,
      divergenceScore: h.divergenceScore,
      marketLabel: h.marketLabel,
      evScore: h.evScore,
      winOdds: h.winOdds,
    }))
    .sort((a, b) => b.divergenceScore - a.divergenceScore)

  return {
    undervalued: allHorses.filter(h => h.marketLabel === '過小評価' || h.marketLabel === '妙味あり'),
    overvalued: allHorses.filter(h => h.marketLabel === '危険人気馬'),
    allHorses,
  }
}

export function calcRaceScore(horses: Horse[]): number {
  const maxEv = Math.max(...horses.map(h => h.evScore))
  const maxSkew = Math.max(...horses.map(h => h.skewScore))
  return maxEv * 0.6 + maxSkew * 2.0
}

/**
 * コース適性 + ペース補正込みのレーススコアを計算する。
 * トップEV馬の脚質がコース・展開と合致しているほどスコアが上昇する。
 */
export function calcRaceScoreWithContext(
  horses: Horse[],
  venue: string,
  surface: Surface,
  pacePrediction?: PacePrediction,
  courseFeature?: CourseFeature,
  trackCondition?: TrackCondition,
  gateTendencyResult?: GateTendencyResult
): number {
  const base = calcRaceScore(horses)
  const topHorse = [...horses].sort((a, b) => (b.aiScore ?? b.evScore) - (a.aiScore ?? a.evScore))[0]
  if (!topHorse) return Math.round(base)

  const courseBonus = calcCourseStyleBonus(topHorse.style, venue, surface)
  const paceBonus = pacePrediction
    ? calcPaceEvBonus(topHorse.style, pacePrediction.pace, courseFeature)
    : 0
  const trackBonus = trackCondition
    ? calcTrackConditionEvBonus(topHorse.style, trackCondition, surface)
    : 0
  const gateBonus = gateTendencyResult
    ? (gateTendencyResult.bonusTable[topHorse.gate] ?? 0)
    : 0

  const divergenceBonus = Math.round(Math.max(-8, Math.min(8, topHorse.divergenceScore * 2)))
  return Math.round(base + courseBonus + paceBonus + trackBonus + gateBonus + divergenceBonus)
}

export function generatePicks(race: Race, pacePrediction?: PacePrediction): Pick[] {
  // aiScore優先でソート（コンテキスト補正済みスコア）
  const sorted = [...race.horses].sort((a, b) => (b.aiScore ?? b.evScore) - (a.aiScore ?? a.evScore))
  const picks: Pick[] = []

  // 1. 最高AIスコア馬の単勝
  const top = sorted[0]
  if (top) {
    const topScore = top.aiScore ?? top.evScore
    const paceContext = pacePrediction
      ? pacePrediction.favoredStyles.includes(top.style)
        ? `【${pacePrediction.pace}】${top.style}脚質に展開が向く。`
        : `【${pacePrediction.pace}】展開面はやや不利だがAIスコア優位を重視。`
      : ''
    const gateBonus = race.gateTendencyResult?.bonusTable[top.gate] ?? 0
    const gateContext = race.gateTendencyResult && race.gateTendencyResult.bias !== 'フラット'
      ? gateBonus > 0
        ? `【枠順】${top.gate}枠は${race.gateTendencyResult.bias}コースで有利（+${gateBonus}）。`
        : gateBonus < 0
          ? `【枠順】${top.gate}枠は${race.gateTendencyResult.bias}コースでやや不利（${gateBonus}）。`
          : ''
      : ''
    const commentHint = top.aiComment ? `【AI判定】${top.aiComment}。` : ''
    picks.push({
      betType: '単勝',
      horses: [top.name],
      odds: top.winOdds,
      confidence: Math.min(88, 45 + topScore),
      reason: `${top.name}の推定勝率${(top.winRate * 100).toFixed(1)}%に対してオッズ${top.winOdds}倍（AIスコア${topScore}）。${commentHint}${paceContext}${gateContext}`,
      horseLabels: { [top.name]: top.marketLabel },
      signal: topScore >= 0 ? 'buy' : 'pass',
      evScore: topScore,
    })
  }

  // 2. 複勝: 妙味あり・過小評価馬を優先、次に人気上位
  const placeCandidate = sorted.find(h => h.marketLabel === '妙味あり' || h.marketLabel === '過小評価')
    ?? sorted.find(h => h.marketLabel === '本命候補')
    ?? sorted[0]
  if (placeCandidate) {
    const placeScore = placeCandidate.aiScore ?? placeCandidate.evScore
    const pr = placeCandidate.pastResults.length
      ? placeCandidate.pastResults.filter(r => r.position <= 3).length / placeCandidate.pastResults.length
      : placeCandidate.popularity <= 3 ? 0.45 : placeCandidate.popularity <= 6 ? 0.30 : 0.15
    picks.push({
      betType: '複勝',
      horses: [placeCandidate.name],
      odds: (placeCandidate.placeOddsMin + placeCandidate.placeOddsMax) / 2,
      confidence: Math.min(82, 40 + placeScore + Math.round(pr * 30)),
      reason: `${placeCandidate.name}（${placeCandidate.marketLabel}・${placeCandidate.popularity}番人気）の複勝は${placeCandidate.placeOddsMin}〜${placeCandidate.placeOddsMax}倍。AIスコア${placeScore}で安定した回収が狙える。`,
      horseLabels: { [placeCandidate.name]: placeCandidate.marketLabel },
      signal: placeScore >= -5 ? 'buy' : 'pass',
      evScore: placeScore,
    })
  }

  // 3. 穴馬とのワイド（危険人気馬以外でaiScore上位の人気薄）
  const valueHorse = sorted.find(h =>
    h.popularity >= 4 &&
    h.marketLabel !== '危険人気馬' &&
    top && h.name !== top.name
  )
  if (top && valueHorse) {
    const approxOdds = parseFloat((top.winOdds * valueHorse.winOdds * 0.07).toFixed(1))
    const valueScore = valueHorse.aiScore ?? valueHorse.evScore
    picks.push({
      betType: 'ワイド',
      horses: [top.name, valueHorse.name],
      odds: Math.max(2.5, approxOdds),
      confidence: Math.min(65, 40 + Math.max(0, valueScore)),
      reason: `${valueHorse.name}（${valueHorse.popularity}番人気・${valueHorse.marketLabel}）とのワイド。AIスコア差異から中穴狙い。`,
      horseLabels: { [top.name]: top.marketLabel, [valueHorse.name]: valueHorse.marketLabel },
      signal: valueScore >= -8 ? 'buy' : 'pass',
      evScore: Math.round(((top.aiScore ?? top.evScore) + valueScore) / 2),
    })
  }

  return picks.slice(0, 3)
}
