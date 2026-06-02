export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getRace, updateRace, RaceAnalysis, HorseAnalysis, LocalHorse } from '@/lib/localData'

// ─── ルールベースフォールバック ──────────────────────────────────────
function ruleBasedAnalysis(horses: LocalHorse[]): Omit<RaceAnalysis, 'analyzedAt'> {
  const analyzed: HorseAnalysis[] = horses.map(h => {
    const base = Math.max(5, Math.min(95, 100 - (h.popularity - 1) * 8))
    const oddsBonus = h.winOdds > 15 ? 8 : h.winOdds > 8 ? 3 : 0
    const aiScore = Math.min(100, base + oddsBonus)
    const survivalScore = Math.max(0, aiScore - 8)

    const decision =
      aiScore >= 65 ? 'KEEP' : aiScore >= 45 ? 'HOLD' : 'ELIMINATE'

    const reasons: string[] = []
    if (h.popularity === 1) reasons.push('1番人気の本命')
    else if (h.popularity <= 3) reasons.push('上位人気で安定感あり')
    else if (h.popularity >= 9) reasons.push('低人気で確率的に厳しい')
    else reasons.push('中位人気、状態次第')
    if (h.winOdds > 15) reasons.push(`${h.winOdds}倍の高配当の可能性`)
    if (h.runningStyle === '逃げ') reasons.push('逃げ馬で展開依存')

    return {
      horseNumber: h.horseNumber,
      horseName: h.horseName,
      aiScore,
      survivalScore,
      decision: decision as HorseAnalysis['decision'],
      reasons,
      valueComment:
        h.winOdds > 15
          ? `単勝${h.winOdds}倍と妙味十分`
          : h.popularity <= 2
          ? `人気馬で信頼度高い`
          : `標準的なオッズ設定`,
    }
  })

  const keeps = analyzed.filter(h => h.decision === 'KEEP')
  const anaume = analyzed.filter(
    h => h.decision === 'HOLD' && horses.find(x => x.horseName === h.horseName)!.winOdds > 10
  )
  const kiken = analyzed.filter(h => h.decision === 'ELIMINATE').slice(0, 4)

  return {
    horses: analyzed,
    honmei: keeps.slice(0, 2).map(h => h.horseName),
    anaume: anaume.slice(0, 2).map(h => h.horseName),
    kiken: kiken.map(h => h.horseName),
    kaime:
      keeps.length > 0
        ? [
            { betType: '単勝', horses: [keeps[0].horseName], reason: 'スコア最上位馬' },
            ...(keeps.length >= 2
              ? [{ betType: '馬連', horses: keeps.slice(0, 2).map(h => h.horseName), reason: '上位2頭の組み合わせ' }]
              : []),
          ]
        : [],
    miokuri: keeps.length === 0,
    overallComment: `※ルールベース分析（APIキー未設定）\n本命候補: ${keeps.slice(0, 2).map(h => h.horseName).join('・') || 'なし'}。ANTHROPIC_API_KEY または OPENAI_API_KEY を .env に設定するとAI分析が有効になります。`,
  }
}

// ─── AI API 呼び出し ─────────────────────────────────────────────────
async function callAI(prompt: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) throw new Error(`Anthropic ${res.status}`)
    const d = await res.json()
    return d.content[0].text
  }

  if (process.env.OPENAI_API_KEY) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) throw new Error(`OpenAI ${res.status}`)
    const d = await res.json()
    return d.choices[0].message.content
  }

  throw new Error('NO_API_KEY')
}

function buildPrompt(
  horses: LocalHorse[],
  info: { venue: string; raceName: string; distance: number; surface: string; trackCondition: string }
): string {
  const list = horses
    .map(
      h =>
        `馬番${h.horseNumber} ${h.horseName} (${h.popularity}番人気, 単勝${h.winOdds}倍${h.jockeyName ? `, 騎手:${h.jockeyName}` : ''}${h.runningStyle ? `, 脚質:${h.runningStyle}` : ''})`
    )
    .join('\n')

  return `競馬レース分析AIです。以下のレースを分析し、JSONのみを返してください（コードブロック不要）。

レース: ${info.venue} ${info.raceName} ${info.surface}${info.distance}m 馬場:${info.trackCondition}

出走馬:
${list}

以下の形式でJSONを返してください:
{
  "horses": [
    {
      "horseNumber": <馬番(数値)>,
      "horseName": "<馬名>",
      "aiScore": <0-100の整数>,
      "survivalScore": <0-100の整数>,
      "decision": "<KEEP|HOLD|ELIMINATE>",
      "reasons": ["<理由1>", "<理由2>"],
      "valueComment": "<20字程度の妙味コメント>"
    }
  ],
  "honmei": ["<本命候補馬名>"],
  "anaume": ["<穴馬候補馬名>"],
  "kiken": ["<危険馬馬名>"],
  "kaime": [
    { "betType": "<単勝|馬連|ワイド等>", "horses": ["<馬名>"], "reason": "<理由>" }
  ],
  "miokuri": <true|false>,
  "overallComment": "<100字以内の総評>"
}`
}

// ─── POST /api/analyze ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { raceId } = await req.json()
    if (!raceId) return NextResponse.json({ error: 'raceId は必須です' }, { status: 400 })

    const race = getRace(raceId)
    if (!race) return NextResponse.json({ error: 'レースが見つかりません' }, { status: 404 })
    if (!race.horses.length)
      return NextResponse.json({ error: '出走馬が登録されていません' }, { status: 400 })

    let partial: Omit<RaceAnalysis, 'analyzedAt'>

    try {
      const text = await callAI(
        buildPrompt(race.horses, {
          venue: race.venue,
          raceName: race.raceName,
          distance: race.distance,
          surface: race.surface,
          trackCondition: race.trackCondition,
        })
      )
      const clean = text.replace(/```json|```/g, '').trim()
      partial = JSON.parse(clean)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('AI call failed, using rule-based fallback:', msg)
      partial = ruleBasedAnalysis(race.horses)
    }

    const analysis: RaceAnalysis = { ...partial, analyzedAt: new Date().toISOString() }
    const updated = updateRace(raceId, { analysis })

    return NextResponse.json({ analysis, race: updated })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
