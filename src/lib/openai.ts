export interface HorseCommentData {
  name: string
  odds: number
  popularity: number
  aiRank: number
  aiScore: number
  evScore: number
  marketLabel: string
  runningStyle: string
  divergenceScore: number
}

export interface RaceCommentInput {
  raceId: string
  raceName: string
  venue: string
  date: string
  surface: string
  distance: string
  grade: string
  trackCondition: string
  pace: string
  courseNote: string
  horses: HorseCommentData[]
  topPicks: string[]
}

export interface RaceComment {
  positive: string
  concern: string
  overall: string
  generatedBy: 'openai' | 'rule'
}

export async function generateRaceCommentOpenAI(input: RaceCommentInput): Promise<RaceComment> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const sorted = [...input.horses].sort((a, b) => b.aiScore - a.aiScore)
  const topHorses = sorted.slice(0, 6).map(h =>
    `${h.name}(AI${h.aiRank}位/${h.popularity}番人気/${h.marketLabel}/EV${h.evScore >= 0 ? '+' : ''}${h.evScore}/脚質:${h.runningStyle || '不明'})`
  ).join(', ')

  const dangerNames = input.horses
    .filter(h => h.marketLabel === '危険人気馬')
    .map(h => h.name).join(', ')

  const prompt = `競馬予想AIです。以下のレース情報を元に分析し、買い材料・不安材料・総合判断の3項目をJSONのみで出力してください（コードブロック・前置き不要）。

レース: ${input.raceName} / ${input.venue} ${input.date} / ${input.surface}${input.distance} ${input.grade || 'OP'}
馬場: ${input.trackCondition} / 展開予想: ${input.pace || '不明'}
コース特性: ${input.courseNote || '不明'}
上位馬: ${topHorses}
${dangerNames ? `危険人気馬（過大評価疑い）: ${dangerNames}` : ''}
推奨買い目: ${input.topPicks.join(', ') || 'なし'}

{"positive":"買い材料（1〜2文、具体的な馬名・根拠を含む）","concern":"不安材料（1〜2文）","overall":"総合判断（1〜2文、買い/見送り判断を含む）"}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 400,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)

  const data = await res.json() as { choices: { message: { content: string } }[] }
  let text = data.choices[0]?.message?.content ?? '{}'
  text = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()

  const parsed = JSON.parse(text) as { positive?: string; concern?: string; overall?: string }
  return {
    positive: parsed.positive ?? '情報不足',
    concern: parsed.concern ?? '情報不足',
    overall: parsed.overall ?? '情報不足',
    generatedBy: 'openai',
  }
}

export function generateRaceCommentRuleBased(input: RaceCommentInput): RaceComment {
  const sorted = [...input.horses].sort((a, b) => b.aiScore - a.aiScore)
  const top = sorted[0]
  const undervalued = input.horses.filter(
    h => h.marketLabel === '過小評価' || h.marketLabel === '妙味あり'
  )
  const danger = input.horses.filter(h => h.marketLabel === '危険人気馬')

  // 買い材料
  const positivePoints: string[] = []
  if (top) {
    if (top.aiScore > 5) positivePoints.push(`${top.name}がAIスコア+${top.aiScore}でトップ評価`)
    if (top.marketLabel === '過小評価' || top.marketLabel === '妙味あり') {
      positivePoints.push(`${top.popularity}番人気ながら市場乖離+${top.divergenceScore}の${top.marketLabel}`)
    }
    if (input.pace && top.runningStyle) {
      positivePoints.push(`${input.pace}予想で${top.runningStyle}脚質が有利`)
    }
  }
  if (undervalued.length > 0 && undervalued[0]?.name !== top?.name) {
    positivePoints.push(`${undervalued[0].name}（${undervalued[0].marketLabel}）も注目`)
  }
  const positive = positivePoints.length > 0
    ? positivePoints.join('。') + '。'
    : 'AIスコア上位馬に注目。'

  // 不安材料
  const concernPoints: string[] = []
  if (danger.length > 0) {
    concernPoints.push(`${danger.map(h => h.name).join('・')}は危険人気馬判定（過大評価の疑い）`)
  }
  if (top && top.evScore < 0) {
    concernPoints.push(`最高評価馬のEVがマイナス（${top.evScore}）`)
  }
  if (input.trackCondition && input.trackCondition !== '良') {
    concernPoints.push(`馬場${input.trackCondition}での適性確認が必要`)
  }
  const concern = concernPoints.length > 0
    ? concernPoints.join('。') + '。'
    : '大きな不安材料は少ないが、展開の変化に注意。'

  // 総合判断
  const hasBuys = input.topPicks.length > 0
  const overall = hasBuys
    ? `${input.topPicks[0]}を中心に購入推奨。期待値プラスの条件が揃っている。`
    : `明確な買い条件に乏しく、今回は見送りを推奨。`

  return { positive, concern, overall, generatedBy: 'rule' }
}
