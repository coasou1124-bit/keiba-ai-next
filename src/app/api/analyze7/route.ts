export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getRace, updateRace, LocalHorse, StepAnalysis, BetSuggestion } from '@/lib/localData'

const NO_DATA = (field: string) => `データ不足（${field}が未入力です）`

// ─── ルールベースフォールバック ──────────────────────────────────────
function ruleBasedStep7(
  horses: LocalHorse[],
  info: { venue: string; raceName: string; distance: number; surface: string; trackCondition: string; weather?: string; trackBiasNote?: string }
): StepAnalysis {
  const sorted = [...horses].sort((a, b) => a.popularity - b.popularity)

  // STEP1: トラックバイアス — trackBiasNote がなければデータ不足
  const step1 = info.trackBiasNote?.trim()
    ? info.trackBiasNote.trim()
    : NO_DATA('トラックバイアス')

  // STEP2: 厩舎コメント — stableComment があれば列挙、なければデータ不足
  const withComments = horses.filter(h => h.stableComment?.trim())
  const step2 = withComments.length > 0
    ? withComments.map(h => `${h.horseName}: ${h.stableComment}`).join(' / ')
    : NO_DATA('厩舎コメント')

  // STEP3: 消し馬 — 人気・オッズは常に取得可能
  const eliminates = horses.filter(h => h.popularity >= 10 || h.winOdds > 50).map(h => h.horseName)
  const withLastRace = horses.filter(h => h.lastRaceInfo?.trim())
  let step3Text = eliminates.length > 0
    ? `${eliminates.join('・')}を消し（低人気または高オッズ）`
    : '人気・オッズから明確な消し馬なし'
  if (withLastRace.length > 0) {
    const badLast = withLastRace.filter(h => /大敗|着外|最下位/.test(h.lastRaceInfo || ''))
    if (badLast.length > 0) step3Text += ` / 前走大敗: ${badLast.map(h => h.horseName).join('・')}`
  } else {
    step3Text += '（前走情報なし）'
  }

  // STEP4: 展開予想 — 脚質がなければデータ不足
  const withStyle = horses.filter(h => h.runningStyle?.trim())
  let step4: string
  if (withStyle.length < horses.length * 0.5) {
    step4 = NO_DATA('脚質（半数以上の馬で未入力）')
  } else {
    const nigeCount = withStyle.filter(h => h.runningStyle === '逃げ').length
    const base = nigeCount > 1 ? 'ハイペース予想。差し・追込に有利な展開になりやすい。' :
      nigeCount === 1 ? 'スローペース予想。逃げ馬残り・先行有利。' :
      '逃げ馬不在。先行勢が流れを作る展開。'
    const missing = horses.length - withStyle.length
    step4 = base + (missing > 0 ? `（脚質未入力: ${missing}頭）` : '')
  }

  // STEP5: 危険な人気馬 — 人気・オッズ・脚質から判定
  const kikenNinkiba = sorted
    .filter(h => h.popularity <= 3 && (
      h.winOdds < 2.0 ||
      (h.runningStyle === '追込' && withStyle.filter(x => x.runningStyle === '逃げ').length === 1)
    ))
    .map(h => h.horseName)
  const step5 = kikenNinkiba.length > 0
    ? `${kikenNinkiba.join('・')}は過剰人気の可能性あり（オッズ過小または展開不向き）`
    : '上位人気馬に特段の危険度なし'

  // STEP6: 印 — newspaperMark がなければデータ不足
  const withMarks = horses.filter(h => h.newspaperMark?.trim())
  let step6: string
  if (withMarks.length === 0) {
    step6 = NO_DATA('新聞印')
  } else {
    const markOrder = ['◎', '○', '▲', '△', '×', '注']
    const ordered = [...withMarks].sort((a, b) =>
      markOrder.indexOf(a.newspaperMark || '') - markOrder.indexOf(b.newspaperMark || '')
    )
    step6 = ordered.map(h => `${h.newspaperMark}${h.horseName}`).join(' ')
    const unmarked = horses.filter(h => !h.newspaperMark?.trim())
    if (unmarked.length > 0) step6 += ` （印なし: ${unmarked.map(h => h.horseName).join('・')}）`
  }

  // STEP7: 妙味判定 — 印がなければデータ不足
  let step7: string
  let oddsMerit: string
  if (withMarks.length === 0) {
    step7 = NO_DATA('新聞印（STEP6の印がないため妙味判定不可）')
    oddsMerit = NO_DATA('新聞印')
  } else {
    const highMarkHighOdds = withMarks.filter(h => {
      const topMarks = ['◎', '○', '▲']
      const horse = horses.find(x => x.horseName === h.horseName)
      return topMarks.includes(h.newspaperMark || '') && (horse?.winOdds ?? 0) >= 10
    })
    if (highMarkHighOdds.length > 0) {
      const items = highMarkHighOdds.map(h => {
        const odds = horses.find(x => x.horseName === h.horseName)?.winOdds ?? '?'
        return `${h.newspaperMark}${h.horseName}(${odds}倍)`
      })
      step7 = `${items.join('・')}は印の割にオッズが高く、妙味あり`
      oddsMerit = items.join('・') + 'が妙味'
    } else {
      step7 = '印とオッズが概ね一致しており、大きな妙味は見当たらない'
      oddsMerit = '大きな妙味なし'
    }
  }

  // 本命・穴・大穴を印ベースで決定（印がなければ人気ベース）
  let honmei: string[], anaume: string[], ooana: string[]
  if (withMarks.length > 0) {
    honmei = withMarks.filter(h => h.newspaperMark === '◎').map(h => h.horseName)
    if (honmei.length === 0) honmei = sorted.slice(0, 1).map(h => h.horseName)
    anaume = withMarks
      .filter(h => ['▲', '△'].includes(h.newspaperMark || '') && (horses.find(x => x.horseName === h.horseName)?.winOdds ?? 0) >= 10)
      .slice(0, 2).map(h => h.horseName)
    ooana = horses
      .filter(h => (h.winOdds ?? 0) > 30 && !['◎', '○'].includes(withMarks.find(m => m.horseName === h.horseName)?.newspaperMark || ''))
      .slice(0, 2).map(h => h.horseName)
  } else {
    honmei = sorted.slice(0, 2).map(h => h.horseName)
    anaume = horses.filter(h => h.winOdds >= 10 && h.winOdds <= 30 && h.popularity <= 8).slice(0, 2).map(h => h.horseName)
    ooana = horses.filter(h => h.winOdds > 30).slice(0, 2).map(h => h.horseName)
  }
  const keshima = eliminates.slice(0, 5)

  // 買い目
  const kaime: BetSuggestion[] = []
  if (honmei.length > 0) {
    kaime.push({ betType: '単勝', horses: [honmei[0]], reason: '◎本命軸' })
    if (anaume.length > 0) kaime.push({ betType: '馬連', horses: [honmei[0], anaume[0]], reason: '本命×穴の組み合わせ' })
    if (honmei.length >= 2) kaime.push({ betType: '馬連', horses: [honmei[0], honmei[1]], reason: '◎○の堅軸' })
    if (ooana.length > 0) kaime.push({ betType: 'ワイド', horses: [honmei[0], ooana[0]], reason: '本命×大穴の妙味狙い' })
  }

  const confidence = withMarks.length > 0 && withComments.length > 0 ? 75 :
    withMarks.length > 0 ? 60 :
    withComments.length > 0 ? 50 : 30
  const worthBuying = keshima.length < horses.length * 0.7

  return {
    steps: [
      { step: 1, title: 'トラックバイアス判定', result: step1, eliminates: [] },
      { step: 2, title: '厩舎コメント確認', result: step2, eliminates: [] },
      { step: 3, title: '絶対に来ない馬を切る', result: step3Text, eliminates },
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
    oddsMerit,
    confidence,
    miokuriReason: worthBuying ? '' : '消し馬が多くレースの質が低い可能性。見送りも選択肢。',
    analyzedAt: new Date().toISOString(),
  }
}

// ─── AI プロンプト ───────────────────────────────────────────────────
function buildStep7Prompt(
  horses: LocalHorse[],
  info: { venue: string; raceName: string; distance: number; surface: string; trackCondition: string; weather?: string; trackBiasNote?: string }
): string {
  const horseList = horses.map(h => {
    const parts = [
      `馬番${h.horseNumber}`,
      h.frameNumber ? `[枠${h.frameNumber}]` : '',
      h.horseName,
      `(${h.popularity}番人気`,
      `単勝${h.winOdds}倍`,
      h.jockeyName ? `騎手:${h.jockeyName}` : '',
      h.runningStyle ? `脚質:${h.runningStyle}` : '脚質:未入力',
      h.newspaperMark ? `印:${h.newspaperMark}` : '印:未入力',
      h.stableComment ? `厩舎コメント:「${h.stableComment}」` : '厩舎コメント:未入力',
      h.lastRaceInfo ? `前走:${h.lastRaceInfo}` : '前走:未入力',
    ].filter(Boolean)
    return parts.join(' ') + ')'
  }).join('\n')

  const weatherLine = info.weather ? `天候: ${info.weather}` : '天候: 未入力'
  const biasLine = info.trackBiasNote?.trim() ? `トラックバイアス: ${info.trackBiasNote}` : 'トラックバイアス: 未入力'

  return `あなたは競馬予想の専門家です。以下の7ステップで厳密に分析し、JSONのみを返してください（コードブロック不要）。

レース: ${info.venue} ${info.raceName || ''} ${info.surface}${info.distance}m 馬場:${info.trackCondition} ${weatherLine}
${biasLine}

出走馬:
${horseList}

【絶対に守るルール】
- 「未入力」と書かれたフィールドは推測・補完しないでください
- 判断に必要なデータが未入力の場合は「データ不足（○○が未入力です）」と返してください
- STEP1はトラックバイアスの入力値のみを根拠にする（未入力ならデータ不足）
- STEP2は厩舎コメント入力値のみを根拠にする（全馬未入力ならデータ不足）
- STEP6は入力された印のみを使う（全馬未入力ならデータ不足と返し印は一切つけない）
- STEP7はSTEP6の印が存在する場合のみ実行する（なければデータ不足）
- 入力されているデータは最大限活用して分析すること

【7ステップ分析】
STEP1: トラックバイアス判定 — 入力されたバイアス情報から有利な枠・脚質を判断
STEP2: 厩舎コメント確認 — 各馬の厩舎コメントを整理・分析
STEP3: 絶対に来ない馬を切る — 人気・オッズ・前走・脚質から消し馬を特定
STEP4: 展開予想 — 脚質分布からペースと有利な馬を予測
STEP5: 危険な人気馬を探す — 過剰人気・展開不向きの低オッズ馬を特定
STEP6: 印をつける — 入力された新聞印を整理・評価する
STEP7: 新聞印とオッズで妙味判定 — 印と実オッズのギャップから高配当狙いを特定

以下の形式でJSONを返してください:
{
  "steps": [
    { "step": 1, "title": "トラックバイアス判定", "result": "<分析結果またはデータ不足>", "eliminates": [] },
    { "step": 2, "title": "厩舎コメント確認", "result": "<分析結果またはデータ不足>", "eliminates": [] },
    { "step": 3, "title": "絶対に来ない馬を切る", "result": "<理由>", "eliminates": ["<消し馬名>"] },
    { "step": 4, "title": "展開予想", "result": "<展開の説明またはデータ不足>", "eliminates": [] },
    { "step": 5, "title": "危険な人気馬を探す", "result": "<説明>", "eliminates": [] },
    { "step": 6, "title": "印をつける", "result": "<印の整理またはデータ不足>", "eliminates": [] },
    { "step": 7, "title": "新聞印とオッズで妙味判定", "result": "<説明またはデータ不足>", "eliminates": [] }
  ],
  "worthBuying": <true|false>,
  "honmei": ["<◎の馬名。印なければ人気上位>"],
  "anaume": ["<穴候補馬名（10〜30倍程度）>"],
  "ooana": ["<大穴候補馬名（30倍以上）>"],
  "kikenNinkiba": ["<危険な人気馬名>"],
  "keshima": ["<消し馬名>"],
  "kaime": [
    { "betType": "<単勝|馬連|三連複|ワイド等>", "horses": ["<馬名>"], "reason": "<根拠となる入力データを明示>" }
  ],
  "oddsMerit": "<妙味の説明またはデータ不足（40字以内）>",
  "confidence": <入力データの充実度に応じた自信度0〜100>,
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
      weather: race.weather,
      trackBiasNote: race.trackBiasNote,
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
