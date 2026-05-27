export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkN8nAuth, unauthorizedResponse } from '@/lib/n8nAuth'

export async function POST(req: NextRequest) {
  if (!checkN8nAuth(req)) return unauthorizedResponse()

  try {
    const body = await req.json().catch(() => ({})) as {
      minEv?: number
      minAiScore?: number
      minBetEv?: number
    }
    const minEv = Number(body.minEv ?? 20)
    const minAiScore = Number(body.minAiScore ?? 30)
    const minBetEv = Number(body.minBetEv ?? 20)

    const { origin } = new URL(req.url)
    const qs = `minEv=${minEv}&minAiScore=${minAiScore}&minBetEv=${minBetEv}`

    const headers: HeadersInit = {}
    const apiKey = process.env.N8N_API_KEY
    if (apiKey) headers['x-api-key'] = apiKey

    const res = await fetch(`${origin}/api/n8n/recommended?${qs}`, { headers })
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 502 })

    const data = await res.json()
    return NextResponse.json({
      ...data,
      triggeredAt: new Date().toISOString(),
      webhookSource: 'POST /api/n8n/webhook',
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
