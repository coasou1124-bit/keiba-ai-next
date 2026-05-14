import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function toStatus(isHit: boolean | null | undefined): 'pending' | 'win' | 'lose' {
  if (isHit === null || isHit === undefined) return 'pending'
  return isHit ? 'win' : 'lose'
}

export async function GET() {
  const bets = await prisma.bet.findMany({ orderBy: { createdAt: 'desc' } })
  const mapped = bets.map(b => ({
    ...b,
    horses: JSON.parse(b.horses) as string[],
    amount: b.stake,
    status: toStatus(b.isHit),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }))
  return NextResponse.json(mapped)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    date, venue, raceNumber, raceName, betType, horses, odds, aiComment,
    surface = '', trackCondition = '', paceType = '', raceId = '',
    marketLabel = '', runningStyle = '',
  } = body
  const isValueBet = Boolean(body.isValueBet ?? false)
  const stake = Number(body.stake ?? body.amount) || 0
  const aiScore = Number(body.aiScore) || 0
  const evScore = Number(body.evScore) || 0
  const popularity = Number(body.popularity) || 0
  const aiRank = Number(body.aiRank) || 0

  const bet = await prisma.bet.create({
    data: {
      date,
      venue,
      raceNumber: Number(raceNumber),
      raceName,
      betType,
      horses: JSON.stringify(horses),
      odds: Number(odds),
      stake,
      evScore,
      aiScore,
      aiComment: aiComment ?? '',
      raceId,
      isValueBet,
      marketLabel,
      surface,
      trackCondition,
      paceType,
      runningStyle,
      popularity,
      aiRank,
    },
  })
  return NextResponse.json({ bet }, { status: 201 })
}
