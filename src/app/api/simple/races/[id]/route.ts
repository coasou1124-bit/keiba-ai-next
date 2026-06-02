export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getRace, updateRace } from '@/lib/localData'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const race = getRace(params.id)
  if (!race) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ race })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const updated = updateRace(params.id, body)
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ race: updated })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
