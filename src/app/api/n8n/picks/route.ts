export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkN8nAuth, unauthorizedResponse } from '@/lib/n8nAuth'

type RacePickRow = {
  id: string
  raceName: string
  date: string
  venue: string
  distance: number
  surface: string
  overallEvScore: number
  optimizedBets: unknown[]
}

export async function GET(req: NextRequest) {
  if (!checkN8nAuth(req)) return unauthorizedResponse()

  try {
    const { searchParams, origin } = new URL(req.url)
    const raceId = searchParams.get('raceId')

    const res = await fetch(`${origin}/api/races`)
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch races' }, { status: 502 })

    const { races } = (await res.json()) as { races: RacePickRow[] }

    let picks = races.map(race => ({
      raceId: race.id,
      raceName: race.raceName,
      date: race.date,
      venue: race.venue,
      distance: race.distance,
      surface: race.surface,
      overallEvScore: race.overallEvScore,
      optimizedBets: race.optimizedBets ?? [],
    }))

    if (raceId) {
      picks = picks.filter(p => p.raceId === raceId)
    }

    return NextResponse.json({ picks })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
