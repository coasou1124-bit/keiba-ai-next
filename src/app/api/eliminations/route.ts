export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkN8nAuth, unauthorizedResponse } from '@/lib/n8nAuth'

// GET /api/eliminations?raceId=xxx&limit=100
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const raceId = searchParams.get('raceId') ?? undefined
  const limit  = Math.min(Number(searchParams.get('limit') ?? 100), 500)

  try {
    const eliminations = await prisma.horseElimination.findMany({
      where: raceId ? { raceId } : {},
      include: {
        horse: { select: { horseName: true, horseNumber: true, popularity: true, winOdds: true } },
        race:  { select: { raceDate: true, venue: true, raceNumber: true, raceName: true } },
      },
      orderBy: { survivalScore: 'desc' },
      take: limit,
    })
    return NextResponse.json({ eliminations, count: eliminations.length })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/eliminations  ← n8n から OpenAI 消去法分析結果を保存
// body: { raceId, horseId, aiScore, survivalScore, decision, eliminateReasons, valueComment }
export async function POST(req: NextRequest) {
  if (!checkN8nAuth(req)) return unauthorizedResponse()

  try {
    const body = await req.json()
    const { raceId, horseId } = body

    if (!raceId || !horseId) {
      return NextResponse.json({ error: 'raceId と horseId は必須です' }, { status: 400 })
    }

    const decision = body.decision ?? 'HOLD'
    if (!['KEEP', 'HOLD', 'ELIMINATE'].includes(decision)) {
      return NextResponse.json({ error: 'decision は KEEP / HOLD / ELIMINATE のいずれかです' }, { status: 400 })
    }

    const toInt = (v: unknown): number => {
      if (typeof v === 'number') return Math.round(v)
      if (typeof v === 'string') return Number(v.replace(/=/, '').trim()) || 0
      return 0
    }

    const aiScore       = toInt(body.aiScore)
    const survivalScore = toInt(body.survivalScore)
    const valueComment  = String(body.valueComment ?? '')

    const elimination = await prisma.horseElimination.upsert({
      where: { raceId_horseId: { raceId, horseId } },
      update: { aiScore, survivalScore, decision, eliminateReasons: [], valueComment },
      create: { raceId, horseId, aiScore, survivalScore, decision, eliminateReasons: [], valueComment },
    })

    return NextResponse.json({ elimination }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
