import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { status, payout, resultPosition, memo, stake: newStake } = body

  const isHit = status === 'win' ? true : status === 'lose' ? false : null

  const existing = await prisma.bet.findUnique({
    where: { id: params.id },
    select: { stake: true },
  })

  const stake = newStake !== undefined ? (Number(newStake) || 0) : (existing?.stake ?? 0)
  const resolvedPayout = isHit ? (Number(payout) || 0) : 0
  const profit = resolvedPayout - stake

  const bet = await prisma.bet.update({
    where: { id: params.id },
    data: {
      isHit,
      payout: resolvedPayout,
      profit,
      stake,
      resultPosition: resultPosition !== undefined ? Number(resultPosition) || 0 : undefined,
      memo: memo !== undefined ? String(memo) : undefined,
    },
  })
  return NextResponse.json({ bet })
}
