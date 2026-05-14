import { Horse, PacePrediction, GateTendencyResult, TrackCondition, Surface, MarketLabel } from '@/types'
import { calcTrackConditionEvBonus } from '@/services/track/trackCondition'

export interface ScoreContext {
  pacePrediction?: PacePrediction
  gateTendencyResult?: GateTendencyResult
  trackCondition?: TrackCondition
  surface?: Surface
}

export interface AIScoreResult {
  aiScore: number
  evScore: number
  marketLabel: MarketLabel
  aiComment: string
}

/**
 * コンテキスト込みAIスコアを計算する。
 * CSV馬（過去成績なし）でも人気・オッズ・展開・枠順・馬場を加点減点対象にする。
 */
export function calculateAIScore(horse: Horse, context: ScoreContext): AIScoreResult {
  const baseEv = horse.evScore
  let bonus = 0
  const reasons: string[] = []

  // 人気薄ボーナス (6番人気以下)
  if (horse.popularity >= 6) {
    bonus += 8
    reasons.push(`穴馬(${horse.popularity}番人気)`)
  }

  // オッズ妙味ボーナス (5倍以上でEVプラス)
  if (horse.winOdds >= 5.0 && baseEv >= 0) {
    bonus += 6
    reasons.push(`オッズ妙味(${horse.winOdds}倍)`)
  }

  // 展開合致ボーナス
  if (context.pacePrediction) {
    const paceBonus = context.pacePrediction.evBonus[horse.style] ?? 0
    bonus += paceBonus
    if (paceBonus > 0) reasons.push(`${context.pacePrediction.pace}×${horse.style}有利`)
    else if (paceBonus < 0) reasons.push(`${context.pacePrediction.pace}×${horse.style}不利`)
  }

  // 枠順ボーナス
  if (context.gateTendencyResult) {
    const gateBonus = context.gateTendencyResult.bonusTable[horse.gate] ?? 0
    bonus += gateBonus
    if (gateBonus > 0) reasons.push(`${horse.gate}枠有利(${context.gateTendencyResult.bias})`)
    else if (gateBonus < 0) reasons.push(`${horse.gate}枠不利`)
  }

  // 馬場適性ボーナス
  if (context.trackCondition && context.surface) {
    const trackBonus = calcTrackConditionEvBonus(horse.style, context.trackCondition, context.surface)
    bonus += trackBonus
    if (trackBonus > 0) reasons.push(`馬場${context.trackCondition}×${horse.style}適性`)
    else if (trackBonus < 0) reasons.push(`馬場${context.trackCondition}×${horse.style}不向`)
  }

  // 危険人気馬ペナルティ (1-2番人気でEV大幅マイナス)
  if (horse.popularity <= 2 && baseEv < -5) {
    bonus -= 15
    reasons.push('危険人気(過大評価疑い)')
  }

  const aiScore = Math.round(Math.max(-100, Math.min(100, baseEv + bonus)))

  // コンテキスト込みのmarketLabel判定
  let marketLabel: MarketLabel
  if (horse.popularity <= 2 && baseEv < -5) {
    marketLabel = '危険人気馬'
  } else if (horse.divergenceScore >= 3 || (horse.popularity >= 5 && aiScore > 8)) {
    marketLabel = '過小評価'
  } else if (aiScore > 3 && horse.popularity >= 4) {
    marketLabel = '妙味あり'
  } else if (horse.aiRank <= 2 && horse.popularity <= 2 && aiScore >= -3) {
    marketLabel = '本命候補'
  } else {
    marketLabel = '標準'
  }

  const aiComment = reasons.length > 0
    ? reasons.slice(0, 3).join(' / ')
    : '標準評価'

  return { aiScore, evScore: baseEv, marketLabel, aiComment }
}
