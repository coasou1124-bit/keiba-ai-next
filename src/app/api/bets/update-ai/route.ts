export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/bets/update-ai
// body: { betId, aiScore, comment }
// ※ risk / recommend は Bet モデルに存在しないため未対応（追加する場合は schema.prisma に追記後 prisma generate が必要）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { betId, aiScore, comment } = body as {
      betId?: string
      aiScore?: number
      risk?: string
      recommend?: boolean
      comment?: string
    }

    if (!betId) {
      return NextResponse.json({ error: 'betId は必須です' }, { status: 400 })
    }

    const bet = await prisma.bet.update({
      where: { id: betId },
      data: {
        ...(aiScore   !== undefined && { aiScore }),
        ...(comment   !== undefined && { aiComment: comment }),
      },
    })

    return NextResponse.json({ success: true, bet })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
