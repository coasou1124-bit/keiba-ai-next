import { NextRequest, NextResponse } from 'next/server'
import {
  RaceCommentInput,
  generateRaceCommentOpenAI,
  generateRaceCommentRuleBased,
} from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const input = await req.json() as RaceCommentInput

    if (!input.raceName || !input.venue) {
      return NextResponse.json({ error: 'レース情報が不足しています' }, { status: 400 })
    }

    let comment
    if (process.env.OPENAI_API_KEY) {
      try {
        comment = await generateRaceCommentOpenAI(input)
      } catch (e) {
        console.error('[race-comment] OpenAI failed, using rule-based:', e)
        comment = generateRaceCommentRuleBased(input)
      }
    } else {
      comment = generateRaceCommentRuleBased(input)
    }

    return NextResponse.json(comment)
  } catch {
    return NextResponse.json({ error: 'コメント生成に失敗しました' }, { status: 500 })
  }
}
