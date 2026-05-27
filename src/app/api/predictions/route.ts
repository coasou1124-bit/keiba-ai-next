export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkN8nAuth, unauthorizedResponse } from '@/lib/n8nAuth'

// GET /api/predictions?raceId=xxx&limit=50
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const raceId = searchParams.get('raceId') ?? undefined
  const limit  = Math.min(Number(searchParams.get('limit') ?? 50), 200)

  try {
    const predictions = await prisma.aiPrediction.findMany({
      where: raceId ? { raceId } : {},
      include: {
        horse: { select: { horseName: true, horseNumber: true, popularity: true, winOdds: true } },
        race:  { select: { raceDate: true, venue: true, raceNumber: true, raceName: true, surface: true, distance: true } },
      },
      orderBy: { aiScore: 'desc' },
      take: limit,
    })
    return NextResponse.json({ predictions, count: predictions.length })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/predictions  ← n8n から OpenAI 分析結果を保存
// body: { raceId, horseId, aiScore, evScore, confidence, marketLabel, openaiComment, modelVersion, rawResponse }
export async function POST(req: NextRequest) {
  if (!checkN8nAuth(req)) return unauthorizedResponse()

  try {
    const body = await req.json()
    const { raceId, horseId } = body

    if (!raceId || !horseId) {
      return NextResponse.json({ error: 'raceId と horseId は必須です' }, { status: 400 })
    }

    const prediction = await prisma.aiPrediction.upsert({
      where: { raceId_horseId: { raceId, horseId } },
      update: {
        aiScore:          body.aiScore          ?? 0,
        evScore:          body.evScore          ?? 0,
        winProbability:   body.winProbability   ?? 0,
        placeProbability: body.placeProbability ?? 0,
        confidence:       body.confidence       ?? 'medium',
        marketLabel:      body.marketLabel      ?? '',
        openaiComment:    body.openaiComment    ?? '',
        modelVersion:     body.modelVersion     ?? 'gpt-4o-mini',
        rawResponse:      body.rawResponse      ?? undefined,
      },
      create: {
        raceId,
        horseId,
        aiScore:          body.aiScore          ?? 0,
        evScore:          body.evScore          ?? 0,
        winProbability:   body.winProbability   ?? 0,
        placeProbability: body.placeProbability ?? 0,
        confidence:       body.confidence       ?? 'medium',
        marketLabel:      body.marketLabel      ?? '',
        openaiComment:    body.openaiComment    ?? '',
        modelVersion:     body.modelVersion     ?? 'gpt-4o-mini',
        rawResponse:      body.rawResponse      ?? undefined,
      },
    })

    return NextResponse.json({ prediction }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
