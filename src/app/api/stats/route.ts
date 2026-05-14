export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { StatsData, SegmentStat } from '@/types'

type BetRow = {
  date: string
  venue: string
  raceNumber: number
  betType: string
  stake: number
  payout: number
  isHit: boolean | null
  aiScore: number
  evScore: number
  surface: string
  trackCondition: string
  popularity: number
  aiRank: number
  paceType: string
  runningStyle: string
  isValueBet: boolean
  marketLabel: string
}

function aggregate(bets: BetRow[], keyFn: (b: BetRow) => string | null): SegmentStat[] {
  const map = new Map<string, { stake: number; payout: number; winCount: number; count: number }>()
  for (const b of bets) {
    const key = keyFn(b)
    if (!key) continue
    const cur = map.get(key) ?? { stake: 0, payout: 0, winCount: 0, count: 0 }
    map.set(key, {
      stake: cur.stake + b.stake,
      payout: cur.payout + b.payout,
      winCount: cur.winCount + (b.isHit ? 1 : 0),
      count: cur.count + 1,
    })
  }
  return Array.from(map.entries()).map(([label, v]) => ({
    label,
    count: v.count,
    winCount: v.winCount,
    winRate: v.count > 0 ? Math.round((v.winCount / v.count) * 100) : 0,
    totalAmount: v.stake,
    totalPayout: v.payout,
    returnRate: v.stake > 0 ? Math.round((v.payout / v.stake) * 100) : 0,
  }))
}

function popularityLabel(p: number): string {
  if (p === 1) return '1番人気'
  if (p === 2) return '2番人気'
  if (p === 3) return '3番人気'
  if (p <= 6) return '4-6番人気'
  return '7番人気以上'
}

function aiRankLabel(r: number): string {
  if (r === 1) return 'AI1位'
  if (r === 2) return 'AI2位'
  if (r === 3) return 'AI3位'
  if (r <= 6) return 'AI4-6位'
  return 'AI7位以上'
}

function evLabel(ev: number): string {
  if (ev >= 10) return 'EV高 (10+)'
  if (ev >= 0) return 'EV中 (0〜9)'
  if (ev >= -10) return 'EV低 (-10〜-1)'
  return 'EV極低 (-11以下)'
}

const POPULARITY_ORDER = ['1番人気', '2番人気', '3番人気', '4-6番人気', '7番人気以上']
const AIRANK_ORDER = ['AI1位', 'AI2位', 'AI3位', 'AI4-6位', 'AI7位以上']
const EV_ORDER = ['EV高 (10+)', 'EV中 (0〜9)', 'EV低 (-10〜-1)', 'EV極低 (-11以下)']
const MARKET_LABEL_ORDER = ['妙味あり', '過小評価', '本命候補', '標準', '危険人気馬']

function sortedSegments(raw: SegmentStat[], order: string[]): SegmentStat[] {
  return order
    .map(label => raw.find(s => s.label === label) ?? { label, count: 0, winCount: 0, winRate: 0, totalAmount: 0, totalPayout: 0, returnRate: 0 })
    .filter(s => s.count > 0)
}

export async function GET() {
  const all = await prisma.bet.findMany()
  const bets = all as unknown as BetRow[]
  const settled = bets.filter(b => b.isHit !== null)

  const totalBets = settled.length
  const totalAmount = settled.reduce((s, b) => s + b.stake, 0)
  const totalPayout = settled.reduce((s, b) => s + b.payout, 0)
  const totalWins = settled.filter(b => b.isHit).length
  const winRate = totalBets > 0 ? Math.round((totalWins / totalBets) * 100) : 0
  const totalProfit = totalPayout - totalAmount
  const returnRate = totalAmount > 0 ? Math.round((totalPayout / totalAmount) * 100) : 0
  const roi = totalAmount > 0 ? Math.round((totalProfit / totalAmount) * 100) : 0

  const raceKeys = new Set(all.map(b => `${b.date}-${b.venue}-${b.raceNumber}`))
  const totalRaces = raceKeys.size

  const betTypeOrder = ['単勝', '複勝', 'ワイド', '馬連']
  const byBetType: SegmentStat[] = betTypeOrder.map(betType => {
    const group = settled.filter(b => b.betType === betType)
    const winCount = group.filter(b => b.isHit).length
    const stake = group.reduce((s, b) => s + b.stake, 0)
    const payout = group.reduce((s, b) => s + b.payout, 0)
    return {
      label: betType,
      count: group.length,
      winCount,
      winRate: group.length > 0 ? Math.round((winCount / group.length) * 100) : 0,
      totalAmount: stake,
      totalPayout: payout,
      returnRate: stake > 0 ? Math.round((payout / stake) * 100) : 0,
    }
  })

  const scoreRanges = [
    { label: '80-100', min: 80, max: 100 },
    { label: '60-79', min: 60, max: 79 },
    { label: '40-59', min: 40, max: 59 },
    { label: '0-39', min: 0, max: 39 },
  ]
  const byScoreRange: SegmentStat[] = scoreRanges.map(({ label, min, max }) => {
    const group = settled.filter(b => b.aiScore >= min && b.aiScore <= max)
    const winCount = group.filter(b => b.isHit).length
    const stake = group.reduce((s, b) => s + b.stake, 0)
    const payout = group.reduce((s, b) => s + b.payout, 0)
    return {
      label,
      count: group.length,
      winCount,
      winRate: group.length > 0 ? Math.round((winCount / group.length) * 100) : 0,
      totalAmount: stake,
      totalPayout: payout,
      returnRate: stake > 0 ? Math.round((payout / stake) * 100) : 0,
    }
  })

  const byVenue = aggregate(settled, b => b.venue || null)
    .sort((a, b) => b.count - a.count)
  const bySurface = aggregate(settled, b => b.surface || null)
  const byTrackCondition = aggregate(settled, b => b.trackCondition || null)
  const byPopularity = sortedSegments(
    aggregate(settled, b => b.popularity > 0 ? popularityLabel(b.popularity) : null),
    POPULARITY_ORDER
  )
  const byAiRank = sortedSegments(
    aggregate(settled, b => b.aiRank > 0 ? aiRankLabel(b.aiRank) : null),
    AIRANK_ORDER
  )
  const byPaceType = aggregate(settled, b => b.paceType || null)
    .sort((a, b) => b.count - a.count)

  const STYLE_ORDER = ['逃げ', '先行', '差し', '追込']
  const byRunningStyle = sortedSegments(
    aggregate(settled, b => b.runningStyle || null),
    STYLE_ORDER
  )

  const byMarketLabel = sortedSegments(
    aggregate(settled, b => b.marketLabel || null),
    MARKET_LABEL_ORDER
  )

  const byEvRange = sortedSegments(
    aggregate(settled, b => evLabel(b.evScore)),
    EV_ORDER
  )

  const dailyMap = new Map<string, { stake: number; payout: number; count: number; winCount: number }>()
  for (const b of settled) {
    const cur = dailyMap.get(b.date) ?? { stake: 0, payout: 0, count: 0, winCount: 0 }
    dailyMap.set(b.date, {
      stake: cur.stake + b.stake,
      payout: cur.payout + b.payout,
      count: cur.count + 1,
      winCount: cur.winCount + (b.isHit ? 1 : 0),
    })
  }
  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, v]) => ({
      date,
      count: v.count,
      winCount: v.winCount,
      winRate: v.count > 0 ? Math.round((v.winCount / v.count) * 100) : 0,
      profit: v.payout - v.stake,
      returnRate: v.stake > 0 ? Math.round((v.payout / v.stake) * 100) : 0,
    }))

  const monthlyMap = new Map<string, { stake: number; payout: number; count: number; winCount: number }>()
  for (const b of settled) {
    const month = b.date.slice(0, 7)
    const cur = monthlyMap.get(month) ?? { stake: 0, payout: 0, count: 0, winCount: 0 }
    monthlyMap.set(month, {
      stake: cur.stake + b.stake,
      payout: cur.payout + b.payout,
      count: cur.count + 1,
      winCount: cur.winCount + (b.isHit ? 1 : 0),
    })
  }
  const monthly = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      count: v.count,
      winCount: v.winCount,
      winRate: v.count > 0 ? Math.round((v.winCount / v.count) * 100) : 0,
      profit: v.payout - v.stake,
      returnRate: v.stake > 0 ? Math.round((v.payout / v.stake) * 100) : 0,
    }))

  const stats: StatsData = {
    totalBets, totalWins, totalRaces, winRate, totalAmount, totalPayout, totalProfit, returnRate, roi,
    byBetType, byScoreRange, byVenue, bySurface, byTrackCondition, byPopularity, byAiRank, byPaceType,
    byMarketLabel, byEvRange, byRunningStyle,
    daily, monthly,
  }
  return NextResponse.json(stats)
}
