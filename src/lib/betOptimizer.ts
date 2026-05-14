import type { Horse, MarketLabel, PacePrediction, TrackConditionResult, BetType, LearningModel } from '@/types'
import { getLearningCorrection } from './learningModel'

export type BetRole = '本命' | '穴' | '保険'

export interface OptimizedBet {
  role: BetRole
  betType: BetType
  horses: string[]
  odds: number
  allocationPct: number
  reason: string
  evScore: number
  signal: 'buy' | 'pass'
  horseLabels?: Record<string, MarketLabel>
}

// 本命のEVがこの閾値未満なら全て見送り
const PASS_EV = -10
// 個別bet見送り閾値
const WARN_EV = -5

function sign(n: number): string {
  return n >= 0 ? '+' : ''
}

export function optimizeBets(
  horses: Horse[],
  context?: {
    pacePrediction?: PacePrediction
    trackConditionResult?: TrackConditionResult
    venue?: string
    surface?: string
    trackCondition?: string
    learningModel?: LearningModel
  }
): OptimizedBet[] {
  if (horses.length === 0) return []

  const sorted = [...horses].sort((a, b) => b.aiScore - a.aiScore)

  // 本命: AIスコア最上位
  const honmei = sorted[0]

  // 穴: 6番人気以下でAIスコアプラス（本命以外・危険人気馬除く）
  //   → 見つからなければ4番人気以下で危険人気馬以外
  const ana =
    sorted.find(
      h =>
        h.name !== honmei.name &&
        h.popularity >= 6 &&
        h.aiScore > 0 &&
        h.marketLabel !== '危険人気馬'
    ) ??
    sorted.find(
      h =>
        h.name !== honmei.name &&
        h.popularity >= 4 &&
        h.marketLabel !== '危険人気馬'
    ) ??
    null

  // 保険: 2番目AIスコア馬（本命・穴以外）
  const hoken =
    sorted.find(h => h.name !== honmei.name && h.name !== ana?.name) ?? null

  const bets: OptimizedBet[] = []

  // 本命用コンテキストノート
  const paceNote = context?.pacePrediction
    ? context.pacePrediction.favoredStyles.includes(honmei.style)
      ? `${context.pacePrediction.pace}で${honmei.style}脚質が有利。`
      : `展開は${honmei.style}にやや不利。`
    : ''
  const trackNote =
    context?.trackConditionResult?.favoredStyles.includes(honmei.style)
      ? `馬場${context.trackConditionResult.condition}に適性あり。`
      : ''

  // 学習補正 (過去データが十分なセグメントのみ反映)
  const learningBonus = context?.learningModel
    ? getLearningCorrection({
        venue: context.venue,
        surface: context.surface,
        trackCondition: context.trackCondition,
        runningStyle: honmei.style,
        marketLabel: honmei.marketLabel,
        learningModel: context.learningModel,
      })
    : 0
  const learningNote = learningBonus !== 0
    ? `過去データ補正${learningBonus >= 0 ? '+' : ''}${learningBonus}。`
    : ''
  const adjustedEv = honmei.aiScore + learningBonus

  // === 本命: 単勝 ===
  bets.push({
    role: '本命',
    betType: '単勝',
    horses: [honmei.name],
    odds: honmei.winOdds,
    allocationPct: 50,
    reason: `${honmei.name}（${honmei.marketLabel}・${honmei.popularity}番人気・${honmei.winOdds}倍）。AIスコア${sign(honmei.aiScore)}${honmei.aiScore}でトップ評価。${paceNote}${trackNote}${learningNote}`,
    evScore: adjustedEv,
    signal: adjustedEv >= PASS_EV ? 'buy' : 'pass',
    horseLabels: { [honmei.name]: honmei.marketLabel },
  })

  // === 穴: ワイド（本命×穴） ===
  if (ana) {
    const anaEv = Math.round((honmei.aiScore + ana.aiScore) / 2)
    const approxOdds = parseFloat((honmei.winOdds * ana.winOdds * 0.07).toFixed(1))
    bets.push({
      role: '穴',
      betType: 'ワイド',
      horses: [honmei.name, ana.name],
      odds: Math.max(2.5, approxOdds),
      allocationPct: 30,
      reason: `${ana.name}（${ana.popularity}番人気・${ana.marketLabel}・AIスコア${sign(ana.aiScore)}${ana.aiScore}）×${honmei.name}のワイド。穴馬の激走を中穴で狙う。`,
      evScore: anaEv,
      signal: anaEv >= WARN_EV ? 'buy' : 'pass',
      horseLabels: {
        [honmei.name]: honmei.marketLabel,
        [ana.name]: ana.marketLabel,
      },
    })
  }

  // === 保険: 複勝 ===
  if (hoken) {
    const hokenOdds =
      Math.round(((hoken.placeOddsMin + hoken.placeOddsMax) / 2) * 10) / 10
    bets.push({
      role: '保険',
      betType: '複勝',
      horses: [hoken.name],
      odds: Math.max(1.1, hokenOdds),
      allocationPct: 20,
      reason: `${hoken.name}（AI${hoken.aiRank}位・${hoken.popularity}番人気・${hoken.marketLabel}）の複勝で安全マージン確保。AIスコア${sign(hoken.aiScore)}${hoken.aiScore}。`,
      evScore: hoken.aiScore,
      signal: hoken.aiScore >= WARN_EV ? 'buy' : 'pass',
      horseLabels: { [hoken.name]: hoken.marketLabel },
    })
  }

  // 本命EVが非常に低ければ（学習補正後）全て見送り
  if (adjustedEv < PASS_EV) {
    return bets.map(b => ({ ...b, signal: 'pass' as const }))
  }

  return bets
}
