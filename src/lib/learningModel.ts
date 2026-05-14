import type { LearningSegment, LearningModel } from '@/types'

const MIN_SAMPLES = 5

export type LearningBetInput = {
  venue: string
  surface: string
  trackCondition: string
  runningStyle: string
  popularity: number
  aiScore: number
  evScore: number
  marketLabel: string
  betType: string
  paceType: string
  stake: number
  payout: number
  isHit: boolean | null
}

function makeSegments(
  bets: LearningBetInput[],
  keyFn: (b: LearningBetInput) => string | null
): LearningSegment[] {
  const map = new Map<string, { stake: number; payout: number; wins: number; count: number }>()
  for (const b of bets) {
    const key = keyFn(b)
    if (!key) continue
    const cur = map.get(key) ?? { stake: 0, payout: 0, wins: 0, count: 0 }
    map.set(key, {
      stake: cur.stake + b.stake,
      payout: cur.payout + b.payout,
      wins: cur.wins + (b.isHit ? 1 : 0),
      count: cur.count + 1,
    })
  }
  return Array.from(map.entries())
    .map(([key, v]) => {
      const returnRate = v.stake > 0 ? Math.round((v.payout / v.stake) * 100) : 0
      const winRate = v.count > 0 ? Math.round((v.wins / v.count) * 100) : 0
      const avgProfit = v.count > 0 ? Math.round((v.payout - v.stake) / v.count) : 0
      const isInsufficient = v.count < MIN_SAMPLES
      // correction: (returnRate - 100) / 100 → -1〜+1 範囲にクランプ
      const correction = isInsufficient ? 0 : Math.max(-1, Math.min(1, (returnRate - 100) / 100))
      return { key, label: key, count: v.count, winRate, returnRate, avgProfit, isInsufficient, correction }
    })
    .sort((a, b) => b.count - a.count)
}

function popularityKey(p: number): string | null {
  if (p <= 0) return null
  if (p === 1) return '1番人気'
  if (p === 2) return '2番人気'
  if (p === 3) return '3番人気'
  if (p <= 6) return '4-6番人気'
  return '7番人気以上'
}

function aiScoreKey(s: number): string {
  if (s >= 20) return 'スコア20+'
  if (s >= 10) return 'スコア10〜19'
  if (s >= 0) return 'スコア0〜9'
  if (s >= -10) return 'スコア-10〜-1'
  return 'スコア-11以下'
}

function evKey(ev: number): string {
  if (ev >= 10) return 'EV高 (10+)'
  if (ev >= 0) return 'EV中 (0〜9)'
  if (ev >= -10) return 'EV低 (-10〜-1)'
  return 'EV極低 (-11以下)'
}

export function computeLearningModel(bets: LearningBetInput[]): LearningModel {
  const settled = bets.filter(b => b.isHit !== null)
  return {
    byVenue:          makeSegments(settled, b => b.venue || null),
    bySurface:        makeSegments(settled, b => b.surface || null),
    byTrackCondition: makeSegments(settled, b => b.trackCondition || null),
    byRunningStyle:   makeSegments(settled, b => b.runningStyle || null),
    byPopularityRange: makeSegments(settled, b => popularityKey(b.popularity)),
    byAiScoreRange:   makeSegments(settled, b => aiScoreKey(b.aiScore)),
    byEvRange:        makeSegments(settled, b => evKey(b.evScore)),
    byMarketLabel:    makeSegments(settled, b => b.marketLabel || null),
    byBetType:        makeSegments(settled, b => b.betType || null),
    byPaceType:       makeSegments(settled, b => b.paceType || null),
    totalSamples: settled.length,
    isInsufficient: settled.length < MIN_SAMPLES,
    updatedAt: new Date().toISOString(),
  }
}

export function getLearningCorrection(params: {
  venue?: string
  surface?: string
  trackCondition?: string
  runningStyle?: string
  marketLabel?: string
  learningModel: LearningModel
}): number {
  const m = params.learningModel
  const candidates: LearningSegment[] = [
    params.venue         ? m.byVenue.find(s => s.key === params.venue)                 : undefined,
    params.surface       ? m.bySurface.find(s => s.key === params.surface)             : undefined,
    params.trackCondition ? m.byTrackCondition.find(s => s.key === params.trackCondition) : undefined,
    params.runningStyle  ? m.byRunningStyle.find(s => s.key === params.runningStyle)   : undefined,
    params.marketLabel   ? m.byMarketLabel.find(s => s.key === params.marketLabel)     : undefined,
  ].filter((s): s is LearningSegment => !!s && !s.isInsufficient)

  if (candidates.length === 0) return 0
  const avg = candidates.reduce((s, c) => s + c.correction, 0) / candidates.length
  return Math.round(avg * 10) // -10〜+10 の補正値
}
