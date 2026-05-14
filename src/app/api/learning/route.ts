import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeLearningModel } from '@/lib/learningModel'
import type { LearningBetInput } from '@/lib/learningModel'

export async function GET() {
  try {
    const bets = await prisma.bet.findMany()
    const model = computeLearningModel(bets as unknown as LearningBetInput[])
    return NextResponse.json(model)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
