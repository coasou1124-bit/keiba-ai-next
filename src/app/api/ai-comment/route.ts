import { NextRequest, NextResponse } from 'next/server'

interface SegmentStat {
  label: string
  count: number
  winCount: number
  winRate: number
  totalAmount: number
  totalPayout: number
  returnRate: number
}

interface StatsInput {
  totalBets: number
  totalWins: number
  totalRaces: number
  winRate: number
  totalAmount: number
  totalPayout: number
  totalProfit: number
  returnRate: number
  roi: number
  byBetType: SegmentStat[]
  byAiRank: SegmentStat[]
  byPopularity: SegmentStat[]
  byPaceType: SegmentStat[]
  byRunningStyle?: SegmentStat[]
  byVenue?: SegmentStat[]
  byMarketLabel: SegmentStat[]
  byEvRange: SegmentStat[]
}

interface CommentSection {
  title: string
  content: string
  type: 'good' | 'warning' | 'neutral' | 'tip'
}

function bestSeg(segs: SegmentStat[], minCount = 2): SegmentStat | null {
  const f = segs.filter(s => s.count >= minCount)
  return f.length === 0 ? null : f.reduce((b, c) => c.returnRate > b.returnRate ? c : b)
}

function worstSeg(segs: SegmentStat[], minCount = 2): SegmentStat | null {
  const f = segs.filter(s => s.count >= minCount)
  return f.length === 0 ? null : f.reduce((b, c) => c.returnRate < b.returnRate ? c : b)
}

function generateRuleBased(s: StatsInput): CommentSection[] {
  const out: CommentSection[] = []

  // 1. 回収率/ROI評価
  const rr = s.returnRate
  out.push({
    title: '回収率・ROI評価',
    content: rr >= 120
      ? `回収率 ${rr}%、ROI +${s.roi}% はプロ級の水準です。この調子を維持しましょう。`
      : rr >= 100
        ? `回収率 ${rr}%（ROI +${s.roi}%）で黒字を確保しています。安定したプラス収支です。`
        : rr >= 80
          ? `回収率 ${rr}%（ROI ${s.roi}%）は赤字圏内です。購入条件の見直しを検討してください。`
          : `回収率 ${rr}%（ROI ${s.roi}%）は大幅赤字です。賭け方・馬券種の根本的な見直しが必要です。`,
    type: rr >= 100 ? 'good' : 'warning',
  })

  // 2. 的中率評価
  const wr = s.winRate
  out.push({
    title: '的中率評価',
    content: wr >= 40
      ? `的中率 ${wr}%（${s.totalWins}/${s.totalBets}件）は高水準です。精度の高い予想ができています。`
      : wr >= 25
        ? `的中率 ${wr}%（${s.totalWins}/${s.totalBets}件）は標準的な水準です。`
        : `的中率 ${wr}%（${s.totalWins}/${s.totalBets}件）はやや低めです。AIスコア上位の馬券に絞ることを検討してください。`,
    type: wr >= 30 ? 'good' : wr >= 20 ? 'neutral' : 'warning',
  })

  // 3. EV分析の傾向
  const evRows = s.byEvRange ?? []
  const evHigh = evRows.find(x => x.label.includes('EV高'))
  const bestEv = bestSeg(evRows)
  let evContent: string
  if (evHigh && evHigh.count > 0) {
    evContent = `EV高(10+)は ${evHigh.count}件・回収率 ${evHigh.returnRate}%。`
    evContent += evHigh.returnRate >= 100
      ? 'EV高の馬券が有効に機能しています。'
      : 'EV単体より他の条件との組み合わせを意識しましょう。'
  } else if (bestEv) {
    evContent = `「${bestEv.label}」が回収率 ${bestEv.returnRate}% で最も優秀です。`
  } else {
    evContent = 'EVデータが蓄積中です。引き続き記録を続けてください。'
  }
  if (evRows.length > 0) {
    out.push({ title: 'EV分析の傾向', content: evContent, type: (evHigh?.returnRate ?? 0) >= 100 ? 'good' : 'neutral' })
  }

  // 4. AI順位別成績の傾向
  const aiRows = s.byAiRank ?? []
  if (aiRows.length > 0) {
    const ai1 = aiRows.find(x => x.label === 'AI1位')
    const bestAi = bestSeg(aiRows)
    let content = ''
    if (ai1 && ai1.count > 0) {
      content = `AI1位推奨馬の回収率は ${ai1.returnRate}%（${ai1.count}件・${ai1.winCount}的中）。`
      if (ai1.returnRate >= 100) {
        content += 'AI1位馬の信頼性が高い状態です。'
      } else if (bestAi && bestAi.label !== 'AI1位') {
        content += `「${bestAi.label}」（${bestAi.returnRate}%）の方が好成績で、1位以外にも注目価値があります。`
      }
    } else if (bestAi) {
      content = `「${bestAi.label}」が回収率 ${bestAi.returnRate}% で安定した成績を残しています。`
    }
    if (content) out.push({ title: 'AI順位別成績の傾向', content, type: (ai1?.returnRate ?? 0) >= 100 ? 'good' : 'neutral' })
  }

  // 5. 人気別成績の傾向
  const popRows = s.byPopularity ?? []
  if (popRows.length > 0) {
    const fav = popRows.find(x => x.label === '1番人気')
    const bestPop = bestSeg(popRows)
    let content = ''
    if (fav && fav.count > 0 && bestPop) {
      content = bestPop.label !== '1番人気'
        ? `1番人気の回収率 ${fav.returnRate}% に対し「${bestPop.label}」が ${bestPop.returnRate}% と高く、穴狙いが有効な傾向です。`
        : `1番人気の回収率 ${fav.returnRate}% が最高で、本命サイドの馬券が安定しています。`
    } else if (bestPop) {
      content = `「${bestPop.label}」の回収率 ${bestPop.returnRate}% が最も優秀です。`
    }
    if (content) out.push({ title: '人気別成績の傾向', content, type: 'neutral' })
  }

  // 6. 展開予想別の傾向
  const paceRows = s.byPaceType ?? []
  if (paceRows.length > 0) {
    const bestPace = bestSeg(paceRows)
    const worstPace = worstSeg(paceRows)
    if (bestPace) {
      let content = `「${bestPace.label}」の展開では回収率 ${bestPace.returnRate}%（${bestPace.count}件）と好成績。`
      if (worstPace && worstPace.label !== bestPace.label) {
        content += `「${worstPace.label}」（${worstPace.returnRate}%）は慎重に判断しましょう。`
      }
      out.push({ title: '展開予想別の傾向', content, type: bestPace.returnRate >= 100 ? 'good' : 'neutral' })
    }
  }

  // 6b. 脚質別成績の傾向
  const styleRows = s.byRunningStyle ?? []
  if (styleRows.length > 0) {
    const bestStyle = bestSeg(styleRows)
    const worstStyle = worstSeg(styleRows)
    if (bestStyle) {
      let content = `「${bestStyle.label}」脚質の回収率が${bestStyle.returnRate}%（${bestStyle.count}件・${bestStyle.winCount}的中）で最も好成績。`
      if (worstStyle && worstStyle.label !== bestStyle.label && worstStyle.returnRate < 90) {
        content += `「${worstStyle.label}」（${worstStyle.returnRate}%）は購入を絞ることを検討してください。`
      }
      if (bestStyle.returnRate >= 100) {
        content += `${bestStyle.label}脚質馬を優先的に狙うと期待値がプラスになりやすい傾向です。`
      }
      out.push({ title: '脚質別成績の傾向', content, type: bestStyle.returnRate >= 100 ? 'good' : 'neutral' })
    }
  }

  // 6c. コース別傾向（上位会場のROIに言及）
  const venueRows = s.byVenue ?? []
  if (venueRows.length >= 2) {
    const best = bestSeg(venueRows, 2)
    const worst = worstSeg(venueRows, 2)
    if (best && worst && best.label !== worst.label) {
      const content = `${best.label}では回収率${best.returnRate}%（${best.count}件）と好成績。${worst.label}（${worst.returnRate}%）では慎重に判断しましょう。`
      out.push({ title: 'コース別成績の傾向', content, type: best.returnRate >= 100 ? 'good' : 'neutral' })
    }
  }

  // 7. 次回狙うべき条件
  const winners = [
    ...(s.byEvRange ?? []),
    ...(s.byMarketLabel ?? []),
    ...(s.byAiRank ?? []),
    ...(s.byPopularity ?? []),
    ...(s.byBetType ?? []),
  ].filter(x => x.count >= 2 && x.returnRate >= 100)
    .sort((a, b) => b.returnRate - a.returnRate)

  out.push({
    title: '次回狙うべき条件',
    content: winners.length > 0
      ? `好成績の条件: ${winners.slice(0, 3).map(x => `${x.label}（回収率${x.returnRate}%）`).join('、')}。これらの条件が重なるレースを優先しましょう。`
      : 'データが蓄積中です。引き続き記録を積み重ねて傾向を分析していきましょう。',
    type: winners.length > 0 ? 'tip' : 'neutral',
  })

  // 8. 改善ポイント
  const points: string[] = []
  const worstBet = worstSeg(s.byBetType ?? [])
  if (worstBet && worstBet.returnRate < 80) {
    points.push(`${worstBet.label}の回収率が${worstBet.returnRate}%と低い — 購入を見直す`)
  }
  const evWorst = (s.byEvRange ?? []).find(x => x.label.includes('極低') && x.count >= 2 && x.returnRate < 80)
  if (evWorst) {
    points.push(`EV極低の馬券（${evWorst.count}件・${evWorst.returnRate}%）は購入を控えることを推奨`)
  }
  if (s.winRate < 20 && s.totalBets >= 10) {
    points.push(`的中率${s.winRate}%は低水準 — AIスコア上位のみに絞り込むと改善が見込める`)
  }

  out.push({
    title: '改善ポイント',
    content: points.length > 0
      ? points.join('\n')
      : 'データの蓄積が進むにつれてより精度の高い分析が可能になります。現時点では大きな問題は見当たりません。',
    type: points.length > 0 ? 'warning' : 'good',
  })

  // セクション数を8に揃える（EV/AI順位/人気/展開がデータ不足でスキップされた場合の穴埋め）
  while (out.length < 8) {
    out.splice(2, 0, {
      title: 'データ蓄積中',
      content: '馬券記録が増えると、このセクションに詳細な傾向分析が表示されます。',
      type: 'neutral',
    })
  }

  return out
}

async function generateOpenAI(s: StatsInput): Promise<CommentSection[]> {
  const apiKey = process.env.OPENAI_API_KEY!
  const segsStr = (segs: SegmentStat[]) =>
    JSON.stringify(segs.filter(x => x.count > 0).map(x => ({ l: x.label, n: x.count, r: x.returnRate })))

  const prompt = `競馬馬券成績の分析AIです。以下のデータを元に8セクションの分析コメントをJSONのみで出力してください（コードブロック・説明文不要）。

データ:
回収率${s.returnRate}% ROI${s.roi}% 的中率${s.winRate}%(${s.totalWins}/${s.totalBets}) 収支${s.totalProfit}円
EV別:${segsStr(s.byEvRange ?? [])}
市場評価:${segsStr(s.byMarketLabel ?? [])}
AI順位:${segsStr(s.byAiRank ?? [])}
人気:${segsStr(s.byPopularity ?? [])}
展開:${segsStr(s.byPaceType ?? [])}
馬券種:${segsStr(s.byBetType ?? [])}

JSON配列（8要素）:
[{"title":"回収率・ROI評価","content":"2-3文の具体的分析（数値引用）","type":"good|warning|neutral|tip"},
 {"title":"的中率評価",...},{"title":"EV分析の傾向",...},{"title":"AI順位別成績の傾向",...},
 {"title":"人気別成績の傾向",...},{"title":"展開予想別の傾向",...},{"title":"次回狙うべき条件",...},
 {"title":"改善ポイント",...}]`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}`)

  const data = await res.json() as { choices: { message: { content: string } }[] }
  let text = data.choices[0]?.message?.content ?? '[]'
  text = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
  return JSON.parse(text) as CommentSection[]
}

export async function POST(req: NextRequest) {
  try {
    const stats = await req.json() as StatsInput
    let sections: CommentSection[]
    let generatedBy: 'rule' | 'openai' = 'rule'

    if (process.env.OPENAI_API_KEY) {
      try {
        sections = await generateOpenAI(stats)
        generatedBy = 'openai'
      } catch {
        sections = generateRuleBased(stats)
      }
    } else {
      sections = generateRuleBased(stats)
    }

    return NextResponse.json({ sections, generatedBy })
  } catch {
    return NextResponse.json({ error: 'コメント生成に失敗しました' }, { status: 500 })
  }
}
