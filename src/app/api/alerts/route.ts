export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkN8nAuth, unauthorizedResponse } from '@/lib/n8nAuth'

// GET /api/alerts?unread=true&limit=50&severity=high
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unread') === 'true'
  const severity   = searchParams.get('severity') ?? undefined
  const limit      = Math.min(Number(searchParams.get('limit') ?? 50), 200)

  try {
    const alerts = await prisma.alert.findMany({
      where: {
        ...(unreadOnly ? { discordSent: false } : {}),
        ...(severity   ? { severity }           : {}),
      },
      include: {
        race:  { select: { raceDate: true, venue: true, raceNumber: true, raceName: true } },
        horse: { select: { horseName: true, horseNumber: true, popularity: true, winOdds: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return NextResponse.json({ alerts, count: alerts.length })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/alerts  ← n8n がオッズ急変・AI推奨・穴馬検知時に呼び出す
// body: { raceId, horseId?, alertType, severity?, title?, message?, data? }
export async function POST(req: NextRequest) {
  if (!checkN8nAuth(req)) return unauthorizedResponse()

  try {
    const body = await req.json()
    const { raceId, alertType } = body

    if (!raceId || !alertType) {
      return NextResponse.json({ error: 'raceId と alertType は必須です' }, { status: 400 })
    }

    const alert = await prisma.alert.create({
      data: {
        raceId,
        horseId:   body.horseId   ?? null,
        alertType,
        severity:  body.severity  ?? 'medium',
        title:     body.title     ?? '',
        message:   body.message   ?? '',
        data:      body.data      ?? undefined,
      },
    })

    return NextResponse.json({ alert }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/alerts  ← Discord 送信済みフラグを一括更新
// body: { ids: string[] }
export async function PATCH(req: NextRequest) {
  if (!checkN8nAuth(req)) return unauthorizedResponse()

  try {
    const { ids } = await req.json() as { ids?: string[] }
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids 配列が必要です' }, { status: 400 })
    }

    const result = await prisma.alert.updateMany({
      where: { id: { in: ids } },
      data: { discordSent: true, discordSentAt: new Date() },
    })

    return NextResponse.json({ updated: result.count })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
