export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkN8nAuth, unauthorizedResponse } from '@/lib/n8nAuth'
import { prisma } from '@/lib/prisma'

// GET /api/n8n/races  ← 既存: AI分析済みレース一覧を返す
export async function GET(req: NextRequest) {
  if (!checkN8nAuth(req)) return unauthorizedResponse()

  try {
    const origin = new URL(req.url).origin
    const res = await fetch(`${origin}/api/races`)
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch races' }, { status: 502 })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/n8n/races  ← n8n がレース + 出走馬データを Supabase に保存
// body: {
//   raceDate: "2024-01-21",
//   venue: "東京",
//   raceNumber: 1,
//   raceName: "サンプルレース",
//   distance: 1600,
//   surface: "芝",
//   trackCondition: "良",
//   weather?: "晴",
//   grade?: "G1",
//   horses: [
//     { horseName, horseNumber, frameNumber?, jockeyName?, popularity, winOdds, runningStyle, ... }
//   ]
// }
export async function POST(req: NextRequest) {
  if (!checkN8nAuth(req)) return unauthorizedResponse()

  try {
    const body = await req.json()
    const { raceDate, venue, raceNumber, horses } = body

    if (!raceDate || !venue || !raceNumber) {
      return NextResponse.json({ error: 'raceDate, venue, raceNumber は必須です' }, { status: 400 })
    }

    // Race を upsert（同じ raceDate+venue+raceNumber なら更新）
    const race = await prisma.race.upsert({
      where: { raceDate_venue_raceNumber: { raceDate, venue, raceNumber } },
      update: {
        raceName:      body.raceName      ?? '',
        distance:      body.distance      ?? 0,
        surface:       body.surface       ?? '',
        trackCondition: body.trackCondition ?? '',
        weather:       body.weather       ?? '',
        grade:         body.grade         ?? '',
        prizeMoney:    body.prizeMoney     ?? 0,
      },
      create: {
        raceDate,
        venue,
        raceNumber,
        raceName:      body.raceName      ?? '',
        distance:      body.distance      ?? 0,
        surface:       body.surface       ?? '',
        trackCondition: body.trackCondition ?? '',
        weather:       body.weather       ?? '',
        grade:         body.grade         ?? '',
        prizeMoney:    body.prizeMoney     ?? 0,
      },
    })

    // 出走馬を upsert（horses 配列が渡された場合）
    const upsertedHorses: { id: string; horseName: string; horseNumber: number }[] = []
    if (Array.isArray(horses) && horses.length > 0) {
      for (const h of horses) {
        if (!h.horseName || !h.horseNumber) continue
        const horse = await prisma.raceHorse.upsert({
          where: { raceId_horseNumber: { raceId: race.id, horseNumber: h.horseNumber } },
          update: {
            horseName:    h.horseName,
            frameNumber:  h.frameNumber   ?? 0,
            jockeyName:   h.jockeyName    ?? '',
            trainerName:  h.trainerName   ?? '',
            weight:       h.weight        ?? 0,
            weightChange: h.weightChange  ?? 0,
            age:          h.age           ?? 0,
            sex:          h.sex           ?? '',
            popularity:   h.popularity    ?? 0,
            winOdds:      h.winOdds       ?? 0,
            placeOdds:    h.placeOdds     ?? 0,
            runningStyle: h.runningStyle  ?? '',
          },
          create: {
            raceId:       race.id,
            horseName:    h.horseName,
            horseNumber:  h.horseNumber,
            frameNumber:  h.frameNumber   ?? 0,
            jockeyName:   h.jockeyName    ?? '',
            trainerName:  h.trainerName   ?? '',
            weight:       h.weight        ?? 0,
            weightChange: h.weightChange  ?? 0,
            age:          h.age           ?? 0,
            sex:          h.sex           ?? '',
            popularity:   h.popularity    ?? 0,
            winOdds:      h.winOdds       ?? 0,
            placeOdds:    h.placeOdds     ?? 0,
            runningStyle: h.runningStyle  ?? '',
          },
        })
        upsertedHorses.push({ id: horse.id, horseName: horse.horseName, horseNumber: horse.horseNumber })
      }
    }

    return NextResponse.json({
      raceId:     race.id,
      raceName:   race.raceName,
      horses:     upsertedHorses,
      horseCount: upsertedHorses.length,
      savedAt:    new Date().toISOString(),
    }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
