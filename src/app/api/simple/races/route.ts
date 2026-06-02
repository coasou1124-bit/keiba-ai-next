export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { readRaces, createRace } from '@/lib/localData'

export async function GET() {
  const races = readRaces()
  return NextResponse.json({ races })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { raceDate, venue, raceNumber, raceName, distance, surface, trackCondition, horses } = body

    if (!raceDate || !venue || !raceNumber) {
      return NextResponse.json({ error: 'raceDate, venue, raceNumber は必須です' }, { status: 400 })
    }

    const race = createRace({
      raceDate,
      venue,
      raceNumber: Number(raceNumber),
      raceName: raceName ?? '',
      distance: Number(distance ?? 0),
      surface: surface ?? '芝',
      trackCondition: trackCondition ?? '良',
      horses: horses ?? [],
    })

    return NextResponse.json({ race }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
