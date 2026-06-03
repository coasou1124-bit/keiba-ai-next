export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getRace, updateRace, LocalHorse, StepAnalysis, BetSuggestion } from '@/lib/localData'

// ─── ルールベースフォールバック ──────────────────────────────────────
function ruleBasedStep7(
  horses: LocalHorse[],
  info: { venue: string; raceName: string; distance: number; surface: string; trackCondition: string }
): StepAnalysis {
  const sorted = [...horses].sort((a, b) => a.popularity - b.popularity)

  // STEP1: トラックバイアス
  const biasMap: Record<string, string> = { '良': 'フラット', '稍重': '内枠やや有利', '重': '内枠有利・先行有利', '不良': '内枠強く有利' }
  const step1 = `${info.surface}${info.trackCondition}馬場。${biasMap[info.trackCondition] ?? 'フラット'}の傾向。`

  // STEP3: 消し馬
  const eliminates = horses.filter(h => h.popularity >= 10 || h.winOdds > 50).map(h => h.horseName)

  // STEP4: 展開
  const nigeCount = horses.filter(h => h.runningStyle === '逃げ').length
  const step4 = nigeCount > 1 ? 'ハイペース予想。差し・追込に有利な展開になりやすい。' :
    nigeCount === 1 ? 'スローペース予想。逃げ馬の残り・先行有利。' :
    '逃げ馬不在。流れは読みにくく、先行馬有利か。'

  // STEP5: 危険な人気馬
  const kikenNinkiba = sorted
    .filter(h => h.popularity <= 3 && (h.winOdds < 2.5 || (h.runningStyle === '追込' && nigeCount === 1)))
    .map(h => h.horseName)
  const step5 = kikenNinkiba.length > 0
    ? `${kikenNinkiba.join('・')}は過剰人気の可能性あり。展開不向きか低オッズ過ぎる。`
    : '上位人気馬に特段の危険度なし。'

  // STEP6: 印
  const top5 = sorted.slice(0, Math.min(5, horses.length))
  const markSymbols = ['◎', '○', '▲', '△', '×']
  const marks = top5.map((h, i) => ({ horseName: h.horseName, mark: markSymbols[i], reason: ['本命', '対抗', '単穴', '連下', '抑え'][i] }))
  const step6 = marks.map(m => `${m.mark}${m.horseName}`).join(' ')

  // STEP7: オッズ妙味
  const ooanaHorses = horses.filter(h => h.winOdds > 30)
  const anaHorses = horses.filter(h => h.winOdds >= 10 && h.winOdds <= 30 && h.popularity <= 8)
  const step7 = ooanaHorses.length > 0
    ? `${ooanaHorses[0].horseName}(${ooanaHorses[0].winOdds}倍)に妙味。印との組み合わせで高配当を狙える。`
    : anaHorses.length > 0
    ? `${anaHorses[0].horseName}(${anaHorses[0].winOdds}倍)が穴で妙味あり。`
    : '大きな妙味なし。順当なオッズ設定。'

  const honmei = sorted.slice(0, 2).filter(h => !kikenNinkiba.includes(h.horseName)).map(h => h.horseName)
  const anaume = anaHorses.slice(0, 2).map(h => h.horseName)
  const ooana = ooanaHorses.slice(0, 2).map(h => h.horseName)
  const keshima = eliminates.slice(0, 5)

  const kaime: BetSuggestion[] = []
  if (honmei.length > 0) {
    kaime.push({ betType: '単勝', horses: [honmei[0]], reason: '◎本命軸' })
    if (anaume.length > 0) kaime.push({ betType: '馬連', horses: [honmei[0], anaume[0]], reason: '本命×穴の組み合わせ' })
    if (honmei.length >= 2) kaime.push({ betType: '馬連', horses: [honmei[0], honmei[1]], reason: '◎○の堅軸' })
    if (ooana.length > 0) kaime.push({ betType: 'ワイド', horses: [honmei[0], ooana[0]], reason: '本命×大穴の妙味' })
  }

  const confidence = kikenNinkiba.length === 0 && eliminates.length <= horses.length * 0.4 ? 70 : 50
  const worthBuying = keshima.length < horses.length * 0.7

  return {
    steps: [
      { step: 1, title: 'トラックバイアス判定', result: step1, eliminates: [] },
      { step: 2, title: '厩舎コメント確認', result: '厩舎コメントデータなし。一般的なコンディションから推測。', eliminates: [] },
      { step: 3, title: '絶対に来ない馬を切る', result: eliminates.length > 0 ? `${eliminates.join('・')}を消し（低人気・高オッズ）` : '明確な消し馬なし', eliminates },
      { step: 4, title: '展開予想', result: step4, eliminates: [] },
      { step: 5, title: '危険な人気馬を探す', result: step5, eliminates: [] },
      { step: 6, title: '印をつける', result: step6, eliminates: [] },
      { step: 7, title: '新聞印とオッズで妙味判定', result: step7, eliminates: [] },
    ],
    worthBuying,
    honmei,
    anaume,
    ooana,
    kikenNinkiba,
    keshima,
    kaime,
    oddsMerit: ooanaHorses.length > 0
      ? `${ooanaHorses[0].horseName}(${ooanaHorses[0].winOdds}倍)が大穴妙味`
      : anaHorses.length > 0
      ? `${anaHorses[0].horseName}(${anaHorses[0].winOdds}倍)が穴妙味`
      : '大きな妙味なし',
    confidence,
    miokuriReason: worthBuying ? '' : '消し馬が多くレースの質が低い可能性。見送りも選択肢。',
    analyzedAt: new Date().toISOString(),
  }
}

// ─── AI プロンプト ───────────────────────────────────────────────────
function buildStep7Prompt(
  horses: LocalHorse[],
  info: { venue: string; raceName: string; distance: number; surface: string; trackCondition: string }
): string {
  const list = horses
    .map(h => `馬番${h.horseNumber} ${h.horseName} (${h.popularity}番人気, 単勝${h.winOdds}倍${h.jockeyName ? `, 騎手:${h.jockeyName}` : ''}${h.runningStyle ? `, 脚質:${h.runningStyle}` : ''})`)
    .join('\n')

  return `あなたは競馬予想の専門家です。以下の7ステップで厳密に分析し、JSONのみを返してください（コードブロック不要）。

レース: ${info.venue} ${info.raceName || ''} ${info.surface}${info.distance}m 馬場:${info.trackCondition}

出走馬:
${list}

【7ステップ分析】
STEP1: トラックバイアス判定 — ${info.venue}の${info.surface}${info.trackCondition}馬場の傾向と有利な枠・脚質を判断
STEP2: 厩舎コメント確認 — データなし、一般的な傾向から推測
STEP3: 絶対に来ない馬を切る — 人気・オッズ・脚質・展開から明らかに厳しい馬を特定
STEP4: 展開予想 — 脚質分布からペース・展開を予測し、有利な馬を特定
STEP5: 危険な人気馬を探す — 過剰人気・展開不向き・オッズに見合わない馬を特定
STEP6: 印をつける — ◎○▲△の印を全馬に割り当て
STEP7: 新聞印とオッズで妙味判定 — 印の高さに対してオッズが高い馬を特定し、高配当を狙う

以下の形式でJSONを返してください:
{
  "steps": [
    { "step": 1, "title": "トラックバイアス判定", "result": "<分析結果>", "eliminates": [] },
    { "step": 2, "title": "厩舎コメント確認", "result": "<分析結果>", "eliminates": [] },
    { "step": 3, "title": "絶対に来ない馬を切る", "result": "<理由>", "eliminates": ["<消し馬名>"] },
    { "step": 4, "title": "展開予想", "result": "<展開の説明>", "eliminates": [] },
    { "step": 5, "title": "危険な人気馬を探す", "result": "<説明>", "eliminates": [] },
    { "step": 6, "title": "印をつける", "result": "◎<馬名> ○<馬名> ▲<馬名> △<馬名>", "eliminates": [] },
    { "step": 7, "title": "新聞印とオッズで妙味判定", "result": "<説明>", "eliminates": [] }
  ],
  "worthBuying": <true|false>,
  "honmei": ["<本命候補馬名>"],
  "anaume": ["<穴候補馬名（10〜30倍程度）>"],
  "ooana": ["<大穴候補馬名（30倍以上）>"],
  "kikenNinkiba": ["<危険な人気馬名>"],
  "keshima": ["<消し馬名>"],
  "kaime": [
    { "betType": "<単勝|馬連|三連複|ワイド等>", "horses": ["<馬名>"], "reason": "<理由>" }
  ],
  "oddsMerit": "<オッズ妙味の説明（40字以内）>",
  "confidence": <自信度0〜100の整数>,
  "miokuriReason": "<見送り推奨の場合の理由。買い推奨なら空文字>"
}`
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
        max_tokens: 3000,
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
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) throw new Error(`OpenAI ${res.status}`)
    const d = await res.json()
    return d.choices[0].message.content
  }

  throw new Error('NO_API_KEY')
}

// ─── POST /api/analyze7 ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { raceId } = await req.json()
    if (!raceId) return NextResponse.json({ error: 'raceId は必須です' }, { status: 400 })

    const race = getRace(raceId)
    if (!race) return NextResponse.json({ error: 'レースが見つかりません' }, { status: 404 })
    if (!race.horses.length) return NextResponse.json({ error: '出走馬が登録されていません' }, { status: 400 })

    const info = {
      venue: race.venue,
      raceName: race.raceName,
      distance: race.distance,
      surface: race.surface,
      trackCondition: race.trackCondition,
    }

    let stepAnalysis: StepAnalysis

    try {
      const text = await callAI(buildStep7Prompt(race.horses, info))
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      stepAnalysis = { ...parsed, analyzedAt: new Date().toISOString() }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('AI call failed, using rule-based fallback:', msg)
      stepAnalysis = ruleBasedStep7(race.horses, info)
    }

    const updated = updateRace(raceId, { stepAnalysis })
    return NextResponse.json({ stepAnalysis, race: updated })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
