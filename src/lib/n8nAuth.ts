import { NextRequest } from 'next/server'

export function checkN8nAuth(req: NextRequest): boolean {
  const apiKey = process.env.N8N_API_KEY
  if (!apiKey) return true

  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === apiKey
  }

  const xApiKey = req.headers.get('x-api-key')
  return xApiKey === apiKey
}

export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'Unauthorized: Invalid or missing API key' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  )
}
