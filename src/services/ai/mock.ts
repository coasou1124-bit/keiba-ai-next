import { Race } from '@/types'

export function getMockAiComment(race: Race): string {
  // aiScore優先でソート（コンテキスト補正済み）
  const topHorse = [...race.horses].sort((a, b) => (b.aiScore ?? b.evScore) - (a.aiScore ?? a.evScore))[0]
  const valueHorse = [...race.horses]
    .filter(h => h.marketLabel === '妙味あり' || h.marketLabel === '過小評価')
    .sort((a, b) => (b.aiScore ?? b.evScore) - (a.aiScore ?? a.evScore))[0]
    ?? [...race.horses].sort((a, b) => b.skewScore - a.skewScore)[0]

  const dangerHorse = race.horses.find(h => h.marketLabel === '危険人気馬')
  const pp = race.pacePrediction
  const tc = race.trackConditionResult
  const gt = race.gateTendencyResult

  const topScore = topHorse ? (topHorse.aiScore ?? topHorse.evScore) : 0

  const paceCtx = pp
    ? `${pp.pace}予想で${pp.favoredStyles.slice(0, 2).join('・')}が有利な展開。`
    : ''

  const topStyleMatch = pp && topHorse
    ? pp.favoredStyles.includes(topHorse.style)
      ? `${topHorse.name}は${topHorse.style}脚質で展開の恩恵を受けやすい。`
      : `${topHorse.name}は${topHorse.style}脚質で展開面はやや逆風だが、AIスコア優位を重視。`
    : ''

  const trackCtx = tc
    ? tc.condition === '良'
      ? `馬場は${tc.condition}でコース本来の特性が発揮される。`
      : tc.favoredStyles.includes(topHorse?.style ?? '')
        ? `馬場${tc.condition}で${topHorse?.style ?? ''}脚質に有利（EV+${tc.evBonus[topHorse?.style ?? '逃げ']}）。`
        : `馬場${tc.condition}は${topHorse?.style ?? ''}脚質にやや不利（EV${tc.evBonus[topHorse?.style ?? '逃げ']}）。`
    : ''

  const gateBonus = gt && topHorse ? (gt.bonusTable[topHorse.gate] ?? 0) : 0
  const gateCtx = gt && gt.bias !== 'フラット' && topHorse
    ? gateBonus > 0
      ? `${topHorse.name}は${topHorse.gate}枠で${gt.bias}コースの恩恵あり（+${gateBonus}）。`
      : gateBonus < 0
        ? `${topHorse.name}は${topHorse.gate}枠で${gt.bias}コースながら外枠（${gateBonus}）。`
        : ''
    : ''

  const divCtx = topHorse
    ? topHorse.marketLabel === '過小評価'
      ? `AI評価${topHorse.aiRank}位・${topHorse.popularity}番人気で乖離+${topHorse.divergenceScore}の過小評価馬。`
      : topHorse.marketLabel === '危険人気馬'
      ? `${topHorse.popularity}番人気もAI評価${topHorse.aiRank}位で過大評価の可能性。`
      : topHorse.marketLabel === '妙味あり'
      ? `${topHorse.popularity}番人気ながらAIスコア+${topScore}・乖離+${topHorse.divergenceScore}で妙味あり。`
      : ''
    : ''

  const dangerCtx = dangerHorse
    ? `【要注意】${dangerHorse.name}（${dangerHorse.popularity}番人気）はAIスコア${dangerHorse.aiScore ?? dangerHorse.evScore}で危険人気馬判定。過大評価の可能性が高い。`
    : ''

  // CSV馬向け: 脚質・展開・馬場の組み合わせを強調したコメント
  const contextSummary = topHorse?.aiComment
    ? `【AI判定材料】${topHorse.aiComment}。`
    : ''

  const comments = [
    `${race.raceName}では${topHorse?.name ?? ''}（AIスコア${topScore > 0 ? '+' : ''}${topScore}）に注目。${divCtx}${paceCtx}${trackCtx}${gateCtx}${contextSummary}${dangerCtx}`,
    `${race.venue}${race.raceNumber}Rでは${valueHorse?.name ?? topHorse?.name ?? ''}（${valueHorse?.marketLabel ?? topHorse?.marketLabel ?? '標準'}・${valueHorse?.popularity ?? topHorse?.popularity ?? ''}番人気）が複勝・ワイドの狙い目。${paceCtx}${trackCtx}${dangerCtx}コンテキスト込みAIスコアで評価。`,
    `${topHorse?.name ?? ''}の推定勝率${topHorse ? (topHorse.winRate * 100).toFixed(1) : ''}%でオッズ${topHorse?.winOdds ?? ''}倍（AIスコア${topScore}）。${divCtx}${topStyleMatch}${trackCtx}${gateCtx}${contextSummary}${dangerCtx}`,
    ...(pp
      ? [`${pp.pace}が予想されるこのレース。${pp.paceNote}${divCtx}${trackCtx}${gateCtx}${topHorse?.name ?? ''}（${topHorse?.style ?? ''}）は${pp.favoredStyles.includes(topHorse?.style ?? '') ? '展開・馬場・枠順・AIスコア四拍子揃った本命候補' : 'AIスコア面で妙味があるが展開・馬場・枠順を総合判断したい一頭'}。${dangerCtx}`]
      : []),
  ]

  return comments[parseInt(race.id.slice(-1)) % comments.length]
}
