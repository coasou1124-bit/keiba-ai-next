export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkN8nAuth, unauthorizedResponse } from '@/lib/n8nAuth'

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
