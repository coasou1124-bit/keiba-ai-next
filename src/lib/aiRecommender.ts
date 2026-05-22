import type { Horse, AiRecommendation, RoleHorse, AiRecBet } from '@/types'

const BUY_EV_THRESHOLD = -5

function sign(n: number): string {
  return n >= 0 ? '+' : ''
}

function makeHorseReasons(h: Horse): string[] {
  const reasons: string[] = []

  // AIスコア（学習補正あり/なし）
  if (h.aiScoreBonus !== undefined && h.aiScoreBonus !== 0 && h.rawAiScore !== undefined) {
    reasons.push(
      `AIスコア${sign(h.aiScore)}${h.aiScore}（補正前${sign(h.rawAiScore)}${h.rawAiScore}、補正${sign(h.aiScoreBonus)}${h.aiScoreBonus}）`
    )
    if (h.aiScoreBonusReason) reasons.push(`ROI補正根拠：${h.aiScoreBonusReason}`)
  } else {
    reasons.push(`AIスコア${sign(h.aiScore)}${h.aiScore}`)
  }

  // 人気との乖離
  const div = h.divergenceScore
  const divStr = `AI${h.aiRank}位 vs 市場${h.popularity}番人気（乖離${sign(div)}${div}）`
  if (div >= 2) reasons.push(`${divStr} → 過小評価`)
  else if (div <= -2) reasons.push(`${divStr} → 過大評価`)
  else reasons.push(divStr)

  // オッズ妙味
  reasons.push(`オッズ${h.winOdds}倍 / 推定勝率${(h.winRate * 100).toFixed(1)}%`)

  return reasons
}

function toRoleHorse(h: Horse, role: RoleHorse['role']): RoleHorse {
  return {
    name: h.name,
    role,
    aiScore: h.aiScore,
    rawAiScore: h.rawAiScore ?? h.aiScore,
    aiScoreBonus: h.aiScoreBonus ?? 0,
    aiScoreBonusReason: h.aiScoreBonusReason ?? '',
    popularity: h.popularity,
    winOdds: h.winOdds,
    marketLabel: h.marketLabel,
    divergenceScore: h.divergenceScore,
    evScore: h.evScore,
    winRate: h.winRate,
    reasons: makeHorseReasons(h),
  }
}

export function buildAiRecommendation(horses: Horse[]): AiRecommendation {
  if (horses.length === 0) return { roles: [], bets: [], summary: '出走馬がありません' }

  const sorted = [...horses].sort((a, b) => b.aiScore - a.aiScore)

  // 本命: AIスコア最上位
  const honmei = sorted[0]

  // 対抗: 2番目のAIスコア（危険人気馬以外を優先）
  const taiko =
    sorted.find(h => h.name !== honmei.name && h.marketLabel !== '危険人気馬') ??
    sorted.find(h => h.name !== honmei.name) ??
    null

  // 穴馬: 6番人気以上で aiScore > 0（本命・対抗以外、危険人気馬除く）
  //        なければ 4番人気以上で divergenceScore >= 2（過小評価型）
  const ana =
    sorted.find(
      h =>
        h.name !== honmei.name &&
        h.name !== taiko?.name &&
        h.popularity >= 6 &&
        h.aiScore > 0 &&
        h.marketLabel !== '危険人気馬'
    ) ??
    sorted.find(
      h =>
        h.name !== honmei.name &&
        h.name !== taiko?.name &&
        h.popularity >= 4 &&
        h.divergenceScore >= 2 &&
        h.marketLabel !== '危険人気馬'
    ) ??
    null

  // 危険人気馬: 上位人気（4番人気以内）でAI評価が低い
  const kiken = sorted.find(h => h.marketLabel === '危険人気馬' && h.popularity <= 4) ?? null

  // ---- ロール割り当て ----
  const roles: RoleHorse[] = [toRoleHorse(honmei, '本命')]
  if (taiko) roles.push(toRoleHorse(taiko, '対抗'))
  if (ana)   roles.push(toRoleHorse(ana,   '穴馬'))
  if (kiken) roles.push(toRoleHorse(kiken, '危険人気馬'))

  // ---- 馬券生成 ----
  const bets: AiRecBet[] = []

  // 単勝: 本命
  {
    const expectedRoi = Math.round(honmei.winOdds * honmei.winRate * 100)
    const evScore = expectedRoi - 100
    const parts: string[] = [
      `AIスコア${sign(honmei.aiScore)}${honmei.aiScore}で全馬中トップ評価`,
      `推定勝率${(honmei.winRate * 100).toFixed(1)}% × オッズ${honmei.winOdds}倍 → 期待回収率${expectedRoi}%`,
    ]
    if (honmei.aiScoreBonus && honmei.aiScoreBonus !== 0 && honmei.aiScoreBonusReason) {
      parts.push(`ROI補正${sign(honmei.aiScoreBonus)}${honmei.aiScoreBonus}（${honmei.aiScoreBonusReason}）`)
    }
    if (honmei.divergenceScore >= 2) {
      parts.push(`市場${honmei.popularity}番人気 vs AI${honmei.aiRank}位（過小評価・妙味あり）`)
    }
    bets.push({
      betType: '単勝',
      horses: [honmei.name],
      odds: honmei.winOdds,
      evScore,
      expectedRoi,
      signal: evScore >= BUY_EV_THRESHOLD ? 'buy' : 'pass',
      reason: parts.join('。'),
    })
  }

  // ワイド: 本命 × 穴馬（穴馬なければ対抗）
  const widePartner = ana ?? taiko
  if (widePartner) {
    const approxOdds = parseFloat(Math.max(2.5, honmei.winOdds * widePartner.winOdds * 0.07).toFixed(1))
    // 複数頭絡み確率（単純加算の1.1倍、ただし上限75%）
    const combinedRate = Math.min(0.75, (honmei.winRate + widePartner.winRate) * 1.1)
    const expectedRoi = Math.round(approxOdds * combinedRate * 100)
    const evScore = expectedRoi - 100
    const parts: string[] = [
      `${honmei.name}（AI${honmei.aiRank}位）× ${widePartner.name}（AI${widePartner.aiRank}位）`,
      `推定オッズ${approxOdds}倍 → 期待回収率${expectedRoi}%`,
    ]
    if (ana && widePartner === ana) {
      parts.push(`穴馬${ana.name}（${ana.popularity}番人気・${ana.winOdds}倍）で高配当狙い`)
    } else {
      parts.push(`AI上位2頭の安定軸ワイド`)
    }
    bets.push({
      betType: 'ワイド',
      horses: [honmei.name, widePartner.name],
      odds: approxOdds,
      evScore,
      expectedRoi,
      signal: evScore >= BUY_EV_THRESHOLD ? 'buy' : 'pass',
      reason: parts.join('。'),
    })
  }

  // 馬連: 本命 × 対抗
  if (taiko) {
    const approxOdds = parseFloat(Math.max(3.0, honmei.winOdds * taiko.winOdds * 0.4).toFixed(1))
    // 馬連期待値: 1〜2着の組み合わせ確率（両頭の勝率合計 × 0.85）
    const combinedRate = Math.min(0.55, (honmei.winRate + taiko.winRate) * 0.85)
    const expectedRoi = Math.round(approxOdds * combinedRate * 100)
    const evScore = expectedRoi - 100
    const parts: string[] = [
      `${honmei.name}（AIスコア${sign(honmei.aiScore)}${honmei.aiScore}）× ${taiko.name}（AIスコア${sign(taiko.aiScore)}${taiko.aiScore}）`,
      `推定オッズ${approxOdds}倍 → 期待回収率${expectedRoi}%`,
      `AI上位2頭の1〜2着固定`,
    ]
    bets.push({
      betType: '馬連',
      horses: [honmei.name, taiko.name],
      odds: approxOdds,
      evScore,
      expectedRoi,
      signal: evScore >= BUY_EV_THRESHOLD ? 'buy' : 'pass',
      reason: parts.join('。'),
    })
  }

  // ---- サマリー ----
  const buyBets = bets.filter(b => b.signal === 'buy')
  const topHorse = `${honmei.name}（${honmei.popularity}番人気・${honmei.winOdds}倍）`
  let summary: string

  if (buyBets.length === 0) {
    summary = `全馬券でEVが低く、見送りも選択肢。`
  } else if (buyBets.length >= 3) {
    summary = `${topHorse}を軸に全馬券で積極買い。`
  } else {
    const types = buyBets.map(b => b.betType).join('・')
    summary = `${topHorse}中心に${types}を推奨。`
  }
  if (kiken) {
    summary += ` ⚠ ${kiken.name}（${kiken.popularity}番人気）は危険人気馬のため軸から外す。`
  }
  if (ana) {
    summary += ` 穴候補：${ana.name}（${ana.popularity}番人気・${ana.winOdds}倍）。`
  }

  return { roles, bets, summary }
}
