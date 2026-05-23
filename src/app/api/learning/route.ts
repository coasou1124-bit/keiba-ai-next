export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeLearningModel } from '@/lib/learningModel'
import type { LearningBetInput } from '@/lib/learningModel'

export async function GET(req: NextRequest) {
  try {
    // ?format=raw → LearningStat レコードをそのまま返す（ダッシュボード用）
    if (new URL(req.url).searchParams.get('format') === 'raw') {
      const stats = await prisma.learningStat.findMany({
        orderBy: [
          { popularityRange: 'asc' },
          { aiScoreRange: 'asc' },
          { venue: 'asc' },
          { surface: 'asc' },
        ],
      })
      return NextResponse.json(stats)
    }

    const bets = await prisma.bet.findMany()
    const model = computeLearningModel(bets as unknown as LearningBetInput[])
    return NextResponse.json(model)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
