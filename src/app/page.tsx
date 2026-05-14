'use client'

import { useEffect, useState } from 'react'
import type { RaceCommentInput, RaceComment } from '@/lib/openai'
import type { OptimizedBet } from '@/types'

// ---- 型定義 ----
interface Horse {
  name: string
  number: number
  gate: number
  odds: number
  winRate?: number
  style?: string
  popularity?: number
  aiScore?: number
}

interface HomeStat {
  totalBets: number
  winRate: number
  roi: number
  returnRate: number
  byMarketLabel: { label: string; count: number; returnRate: number }[]
}

interface Pick {
  betType: string
  horses: string[]
  odds: number
  signal: 'buy' | 'pass'
  aiScore: number
  evScore: number
  confidence?: number
  horseLabels?: Record<string, MarketLabel>
}

interface CourseFeature {
  venueScale: '大箱' | '小回り'
  straightLength: number
  hasSlope: boolean
  distanceCategory: 'スプリント' | 'マイル' | '中距離' | '長距離'
  favoredStyles: string[]
  surfaceNote: string
  courseNote: string
  aiHint: string
}

type PaceType = 'ハイペース' | 'ミドルペース' | 'スローペース'
type TrackCondition = '良' | '稍重' | '重' | '不良'
type GateBias = '内有利' | '外有利' | 'フラット'
type MarketLabel = '過小評価' | '妙味あり' | '危険人気馬' | '本命候補' | '標準'

interface TrackConditionResult {
  condition: TrackCondition
  favoredStyles: string[]
  penalizedStyles: string[]
  evBonus: Record<string, number>
  conditionNote: string
}

interface GateTendencyResult {
  bias: GateBias
  note: string
  maxGate: number
  favoredGates: number[]
  penalizedGates: number[]
  bonusTable: Record<number, number>
}

interface HorseDivergence {
  name: string
  aiRank: number
  popularity: number
  divergenceScore: number
  marketLabel: MarketLabel
  evScore: number
  winOdds: number
}

interface MarketDivergenceResult {
  undervalued: HorseDivergence[]
  overvalued: HorseDivergence[]
  allHorses: HorseDivergence[]
}

interface StyleDistribution {
  逃げ: number
  先行: number
  差し: number
  追込: number
}

interface PacePrediction {
  pace: PaceType
  styleDistribution: StyleDistribution
  favoredStyles: string[]
  penalizedStyles: string[]
  paceNote: string
  courseInteractionNote: string
  evBonus: Record<string, number>
}

interface Race {
  id: string
  date: string
  venue: string
  raceNumber: number
  raceName: string
  grade: string
  distance: string
  surface: string
  distortionScore: number
  evScore: number
  confidence: number
  aiComment: string
  picks: Pick[]
  horses?: Horse[]
  courseFeature?: CourseFeature
  pacePrediction?: PacePrediction
  trackCondition?: TrackCondition
  trackConditionResult?: TrackConditionResult
  gateTendencyResult?: GateTendencyResult
  marketDivergenceResult?: MarketDivergenceResult
  optimizedBets?: OptimizedBet[]
}

// ---- BetForm 状態 ----
interface BetFormState {
  amount: string
  submitting: boolean
  submitted: boolean
  error: string | null
}

// ---- ユーティリティ ----
function normalizeScore(score: number, min = -60, max = 60): number {
  return Math.min(100, Math.max(0, ((score - min) / (max - min)) * 100))
}

function renderStars(confidence: number): string {
  const filled = Math.round(confidence / 20)
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}

function gradeColor(grade: string): string {
  if (grade === 'G1') return 'text-yellow-300 bg-yellow-400/10 border-yellow-400/30'
  if (grade === 'G2') return 'text-purple-300 bg-purple-400/10 border-purple-400/30'
  if (grade === 'G3') return 'text-blue-300 bg-blue-400/10 border-blue-400/30'
  return 'text-white/60 bg-white/5 border-white/10'
}

// ---- スケルトンカード ----
function SkeletonCard() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm animate-pulse">
      <div className="h-5 bg-white/10 rounded w-2/3 mb-3" />
      <div className="h-3 bg-white/10 rounded w-1/3 mb-4" />
      <div className="h-2 bg-white/10 rounded w-full mb-2" />
      <div className="h-2 bg-white/10 rounded w-5/6 mb-4" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-white/10 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ---- 市場ラベルスタイル ----
const MARKET_LABEL_STYLE: Record<MarketLabel, { chip: string; icon: string }> = {
  '過小評価':  { chip: 'text-green-300 bg-green-400/15 border-green-400/40',  icon: '↑' },
  '妙味あり':  { chip: 'text-teal-300 bg-teal-400/15 border-teal-400/40',    icon: '◎' },
  '危険人気馬': { chip: 'text-red-300 bg-red-400/15 border-red-400/40',       icon: '！' },
  '本命候補':  { chip: 'text-amber-300 bg-amber-400/15 border-amber-400/40',  icon: '★' },
  '標準':     { chip: 'text-white/35 bg-white/5 border-white/15',            icon: '−' },
}

// ---- 買い目最適化パネル ----
const ROLE_CONFIG: Record<
  '本命' | '穴' | '保険',
  { icon: string; border: string; bg: string; badge: string }
> = {
  '本命': {
    icon: '★',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    badge: 'text-amber-300 bg-amber-400/15 border-amber-400/40',
  },
  '穴': {
    icon: '◎',
    border: 'border-violet-500/30',
    bg: 'bg-violet-500/5',
    badge: 'text-violet-300 bg-violet-400/15 border-violet-400/40',
  },
  '保険': {
    icon: '△',
    border: 'border-sky-500/30',
    bg: 'bg-sky-500/5',
    badge: 'text-sky-300 bg-sky-400/15 border-sky-400/40',
  },
}

function OptimizedBetRow({
  bet,
  race,
  amount,
  onRecorded,
}: {
  bet: OptimizedBet
  race: Race
  amount: number
  onRecorded: () => void
}) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cfg = ROLE_CONFIG[bet.role]
  const isBuy = bet.signal === 'buy'

  async function handleRecord() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raceId: race.id,
          date: race.date,
          venue: race.venue,
          raceNumber: race.raceNumber,
          raceName: race.raceName,
          betType: bet.betType,
          horses: bet.horses,
          odds: bet.odds,
          amount,
          aiScore: bet.evScore,
          evScore: bet.evScore,
          aiComment: bet.reason,
          surface: race.surface ?? '',
          trackCondition: race.trackCondition ?? '',
          paceType: race.pacePrediction?.pace ?? '',
          popularity:
            race.marketDivergenceResult?.allHorses.find(
              h => h.name === bet.horses[0]
            )?.popularity ?? 0,
          aiRank:
            race.marketDivergenceResult?.allHorses.find(
              h => h.name === bet.horses[0]
            )?.aiRank ?? 0,
          isValueBet: isBuy,
          marketLabel: bet.horseLabels?.[bet.horses[0]] ?? '',
          runningStyle:
            race.horses?.find(h => h.name === bet.horses[0])?.style ?? '',
        }),
      })
      if (!res.ok) throw new Error('記録に失敗しました')
      setSubmitted(true)
      onRecorded()
    } catch (err) {
      setError(err instanceof Error ? err.message : '記録に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`px-3 py-2 ${cfg.bg}`}>
      <div className="flex items-center gap-2 flex-wrap">
        {/* ロールバッジ */}
        <span
          className={`text-[10px] font-bold border px-1.5 py-0.5 rounded flex-shrink-0 ${cfg.badge}`}
        >
          {cfg.icon} {bet.role}
        </span>
        {/* 買い方 */}
        <span className="text-white/70 text-xs bg-white/10 px-2 py-0.5 rounded flex-shrink-0">
          {bet.betType}
        </span>
        {/* 馬名 */}
        <span className="text-white/90 text-sm font-medium">
          {bet.horses.join(' × ')}
        </span>
        {/* オッズ */}
        <span className="text-white/40 text-xs flex-shrink-0">
          {bet.odds.toFixed(1)}倍
        </span>
        {/* 配分 */}
        <span className="text-white/30 text-xs flex-shrink-0">
          {bet.allocationPct}%
        </span>
        {/* 金額 */}
        {amount > 0 && (
          <span className="text-amber-300/70 text-xs font-bold flex-shrink-0">
            ¥{amount.toLocaleString()}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <span
            className={`text-xs font-bold ${
              bet.evScore >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            EV {bet.evScore >= 0 ? '+' : ''}
            {bet.evScore}
          </span>
          <span
            className={`text-xs font-bold ${
              isBuy ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {isBuy ? '▲買い' : '▼見送'}
          </span>
          {!submitted ? (
            <button
              onClick={() => setOpen(o => !o)}
              className="text-[10px] text-white/30 hover:text-white/60 border border-white/15 rounded px-2 py-0.5 transition-colors"
            >
              {open ? '閉じる' : '記録'}
            </button>
          ) : (
            <span className="text-green-400 text-xs font-bold">✓</span>
          )}
        </div>
      </div>

      {/* 理由 */}
      <p className="text-white/40 text-xs leading-relaxed mt-1.5 pr-2">
        {bet.reason}
      </p>

      {/* 記録フォーム */}
      {open && !submitted && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRecord}
            disabled={submitting}
            className="bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg px-3 py-1 text-xs font-bold hover:bg-amber-500/30 transition-colors disabled:opacity-50"
          >
            {submitting
              ? '記録中...'
              : `¥${amount.toLocaleString()} で保存`}
          </button>
          {error && <span className="text-red-400 text-xs">{error}</span>}
        </div>
      )}
    </div>
  )
}

function OptimizedBetsPanel({
  bets,
  race,
  onRecorded,
}: {
  bets: OptimizedBet[]
  race: Race
  onRecorded: () => void
}) {
  const [budget, setBudget] = useState('3000')
  const budgetNum = Math.max(100, parseInt(budget) || 3000)
  const allPass = bets.every(b => b.signal === 'pass')

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden mb-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-3 py-2 bg-white/3 border-b border-white/5">
        <span className="text-white/60 text-xs font-medium">買い目提案</span>
        <div className="flex items-center gap-1.5">
          <label className="text-white/30 text-xs">予算</label>
          <input
            type="number"
            min={100}
            step={100}
            value={budget}
            onChange={e => setBudget(e.target.value)}
            className="w-20 bg-white/10 border border-white/15 rounded px-2 py-0.5 text-white text-xs text-right focus:outline-none focus:border-amber-400/40"
          />
          <span className="text-white/30 text-xs">円</span>
        </div>
      </div>

      {allPass ? (
        <div className="px-3 py-4 text-center">
          <span className="text-red-400/80 text-xs">
            × 今回は見送りを推奨（全体EVマイナス）
          </span>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {bets.map((bet, i) => (
            <OptimizedBetRow
              key={i}
              bet={bet}
              race={race}
              amount={
                Math.floor((budgetNum * bet.allocationPct) / 100 / 100) * 100
              }
              onRecorded={onRecorded}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---- 買い目行 ----
function PickRow({
  pick,
  race,
  onRecorded,
  labelRoi,
}: {
  pick: Pick
  race: Race
  onRecorded: () => void
  labelRoi?: Map<string, number>
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<BetFormState>({
    amount: '1000',
    submitting: false,
    submitted: false,
    error: null,
  })

  const isBuy = pick.signal === 'buy'
  const primaryHorse = race.horses?.find(h => h.name === pick.horses[0])
  const winRatePct = primaryHorse?.winRate != null ? Math.round(primaryHorse.winRate * 100) : null
  const confidencePct = pick.confidence != null ? Math.round(pick.confidence) : null
  const pickLabel = pick.horseLabels?.[pick.horses[0]] ?? null
  const pastRoi = (labelRoi && pickLabel) ? (labelRoi.get(pickLabel) ?? null) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setForm((f) => ({ ...f, submitting: true, error: null }))
    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raceId: race.id,
          date: race.date,
          venue: race.venue,
          raceNumber: race.raceNumber,
          raceName: race.raceName,
          betType: pick.betType,
          horses: pick.horses,
          odds: pick.odds,
          amount: Number(form.amount),
          aiScore: pick.confidence ?? pick.aiScore ?? 0,
          evScore: pick.evScore ?? 0,
          aiComment: race.aiComment,
          surface: race.surface ?? '',
          trackCondition: race.trackCondition ?? '',
          paceType: race.pacePrediction?.pace ?? '',
          popularity: race.marketDivergenceResult?.allHorses.find(h => h.name === pick.horses[0])?.popularity ?? 0,
          aiRank: race.marketDivergenceResult?.allHorses.find(h => h.name === pick.horses[0])?.aiRank ?? 0,
          isValueBet: pick.signal === 'buy',
          marketLabel: pick.horseLabels?.[pick.horses[0]] ?? '',
          runningStyle: race.horses?.find(h => h.name === pick.horses[0])?.style ?? '',
        }),
      })
      if (!res.ok) throw new Error('記録に失敗しました')
      setForm((f) => ({ ...f, submitting: false, submitted: true }))
      onRecorded()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '記録に失敗しました'
      setForm((f) => ({ ...f, submitting: false, error: message }))
    }
  }

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-white/3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white/70 text-xs font-medium bg-white/10 px-2 py-0.5 rounded">
            {pick.betType}
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            {pick.horses.map((name, i) => {
              const label = pick.horseLabels?.[name]
              const cfg = label && label !== '標準' ? MARKET_LABEL_STYLE[label] : null
              return (
                <span key={name} className="inline-flex items-center gap-1">
                  {i > 0 && <span className="text-white/30 text-xs">-</span>}
                  <span className="text-white/90 text-sm font-medium">{name}</span>
                  {cfg && (
                    <span className={`text-[10px] font-bold border px-1 py-0.5 rounded ${cfg.chip}`}>
                      {cfg.icon} {label}
                    </span>
                  )}
                </span>
              )
            })}
          </div>
          <span className="text-white/50 text-xs">オッズ {pick.odds.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          <span
            className={`text-xs font-bold ${isBuy ? 'text-green-400' : 'text-red-400'}`}
          >
            {isBuy ? '▲ 買い' : '▼ 見送'}
          </span>
          <span
            className={`text-xs font-bold ${
              pick.evScore >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            EV {pick.evScore >= 0 ? '+' : ''}
            {pick.evScore}
          </span>
          {confidencePct != null && (
            <span className="text-xs text-violet-300/80 hidden sm:inline">
              信頼 {confidencePct}%
            </span>
          )}
          {winRatePct != null && (
            <span className="text-xs text-sky-300/80 hidden sm:inline">
              勝率 {winRatePct}%
            </span>
          )}
          {pastRoi != null && (
            <span className={`text-xs hidden sm:inline ${pastRoi >= 0 ? 'text-green-400/80' : 'text-red-400/80'}`}>
              過去ROI {pastRoi >= 0 ? '+' : ''}{pastRoi}%
            </span>
          )}
          {!form.submitted ? (
            <button
              onClick={() => setOpen((o) => !o)}
              className="bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg px-3 py-1 text-xs font-bold hover:bg-amber-500/30 transition-colors"
            >
              {open ? '閉じる' : '記録する'}
            </button>
          ) : (
            <span className="text-green-400 text-xs font-bold">記録しました ✓</span>
          )}
        </div>
      </div>

      {open && !form.submitted && (
        <form
          onSubmit={handleSubmit}
          className="px-3 py-3 bg-white/5 border-t border-white/10"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-white/60 text-xs">購入金額</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={100}
                step={100}
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-28 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-400/50"
              />
              <span className="text-white/50 text-xs">円</span>
            </div>
            <button
              type="submit"
              disabled={form.submitting}
              className="bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg px-4 py-1.5 text-sm font-bold hover:bg-amber-500/30 transition-colors disabled:opacity-50"
            >
              {form.submitting ? '記録中...' : '保存する'}
            </button>
          </div>
          {form.error && (
            <p className="text-red-400 text-xs mt-2">{form.error}</p>
          )}
        </form>
      )}
    </div>
  )
}

// ---- コース特徴パネル ----
function CourseFeaturePanel({ feature }: { feature: CourseFeature }) {
  const distanceBadgeColor: Record<CourseFeature['distanceCategory'], string> = {
    'スプリント': 'text-orange-300 bg-orange-400/10 border-orange-400/30',
    'マイル':     'text-sky-300 bg-sky-400/10 border-sky-400/30',
    '中距離':     'text-emerald-300 bg-emerald-400/10 border-emerald-400/30',
    '長距離':     'text-violet-300 bg-violet-400/10 border-violet-400/30',
  }
  const styleChipColor = (s: string) => {
    if (s === '逃げ') return 'text-red-300 bg-red-400/10 border-red-400/30'
    if (s === '先行') return 'text-orange-300 bg-orange-400/10 border-orange-400/30'
    if (s === '差し') return 'text-blue-300 bg-blue-400/10 border-blue-400/30'
    return 'text-purple-300 bg-purple-400/10 border-purple-400/30'
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 mb-3">
      {/* ヘッダー行 */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className="text-white/50 text-xs font-medium">コース特徴</span>
        <span className={`text-xs font-bold border px-1.5 py-0.5 rounded ${distanceBadgeColor[feature.distanceCategory]}`}>
          {feature.distanceCategory}
        </span>
        <span className="text-white/30 text-xs">
          直線 {feature.straightLength}m
        </span>
        <span className={`text-xs border px-1.5 py-0.5 rounded ${feature.venueScale === '大箱' ? 'text-teal-300 bg-teal-400/10 border-teal-400/30' : 'text-yellow-300 bg-yellow-400/10 border-yellow-400/30'}`}>
          {feature.venueScale}
        </span>
        {feature.hasSlope && (
          <span className="text-xs text-rose-300 bg-rose-400/10 border border-rose-400/30 px-1.5 py-0.5 rounded">
            急坂あり
          </span>
        )}
      </div>

      {/* 有利脚質 */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className="text-white/40 text-xs">有利な脚質</span>
        {feature.favoredStyles.map((s) => (
          <span key={s} className={`text-xs font-bold border px-2 py-0.5 rounded ${styleChipColor(s)}`}>
            {s}
          </span>
        ))}
      </div>

      {/* コース説明 */}
      <p className="text-white/50 text-xs leading-relaxed">{feature.surfaceNote}</p>
    </div>
  )
}

// ---- 展開予想パネル ----
const STYLE_CONFIG = {
  逃げ: { bar: 'bg-red-400',    chip: 'text-red-300 bg-red-400/10 border-red-400/30' },
  先行: { bar: 'bg-orange-400', chip: 'text-orange-300 bg-orange-400/10 border-orange-400/30' },
  差し: { bar: 'bg-blue-400',   chip: 'text-blue-300 bg-blue-400/10 border-blue-400/30' },
  追込: { bar: 'bg-purple-400', chip: 'text-purple-300 bg-purple-400/10 border-purple-400/30' },
} as const

function PacePredictionPanel({ pred }: { pred: PacePrediction }) {
  const paceColor: Record<PaceType, string> = {
    'ハイペース':  'text-red-300 bg-red-400/10 border-red-400/30',
    'ミドルペース': 'text-yellow-300 bg-yellow-400/10 border-yellow-400/30',
    'スローペース': 'text-sky-300 bg-sky-400/10 border-sky-400/30',
  }
  const paceIcon: Record<PaceType, string> = {
    'ハイペース':  '⚡',
    'ミドルペース': '〜',
    'スローペース': '🐢',
  }

  const allStyles = ['逃げ', '先行', '差し', '追込'] as const
  const total = allStyles.reduce((s, k) => s + pred.styleDistribution[k], 0)

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 mb-3">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-white/50 text-xs font-medium">展開予想</span>
        <span className={`text-xs font-bold border px-2 py-0.5 rounded ${paceColor[pred.pace]}`}>
          {paceIcon[pred.pace]} {pred.pace}
        </span>
        {pred.favoredStyles.length > 0 && (
          <span className="text-white/40 text-xs">
            → {pred.favoredStyles.join('・')}有利
          </span>
        )}
      </div>

      {/* 脚質分布 */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {allStyles.map((style) => {
          const count = pred.styleDistribution[style]
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const isFavored = pred.favoredStyles.includes(style)
          const isPenalized = pred.penalizedStyles.includes(style)
          const cfg = STYLE_CONFIG[style]
          return (
            <div key={style} className="flex flex-col items-center gap-1">
              <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded w-full text-center ${cfg.chip}`}>
                {style}
              </span>
              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${cfg.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-white/60 text-xs font-bold">{count}頭</span>
              {isFavored && (
                <span className="text-[10px] text-green-400 font-bold leading-none">▲有利</span>
              )}
              {isPenalized && !isFavored && (
                <span className="text-[10px] text-red-400 font-bold leading-none">▼不利</span>
              )}
            </div>
          )
        })}
      </div>

      {/* 展開テキスト */}
      <p className="text-white/50 text-xs leading-relaxed mb-1">{pred.paceNote}</p>
      {pred.courseInteractionNote && (
        <p className="text-amber-400/60 text-xs leading-relaxed">{pred.courseInteractionNote}</p>
      )}
    </div>
  )
}

// ---- 馬場補正パネル ----
function TrackConditionPanel({ result }: { result: TrackConditionResult }) {
  const conditionColor: Record<TrackCondition, string> = {
    '良':   'text-green-300 bg-green-400/10 border-green-400/30',
    '稍重': 'text-yellow-300 bg-yellow-400/10 border-yellow-400/30',
    '重':   'text-orange-300 bg-orange-400/10 border-orange-400/30',
    '不良': 'text-red-300 bg-red-400/10 border-red-400/30',
  }

  const allStyles = ['逃げ', '先行', '差し', '追込'] as const

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 mb-3">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-white/50 text-xs font-medium">馬場補正</span>
        <span className={`text-xs font-bold border px-2 py-0.5 rounded ${conditionColor[result.condition]}`}>
          {result.condition}
        </span>
        {result.favoredStyles.length > 0 ? (
          <span className="text-white/40 text-xs">
            → {result.favoredStyles.join('・')}有利
          </span>
        ) : (
          <span className="text-white/30 text-xs">標準（補正なし）</span>
        )}
      </div>

      {/* EV補正グリッド */}
      <div className="grid grid-cols-4 gap-2 mb-2">
        {allStyles.map((style) => {
          const bonus = result.evBonus[style] ?? 0
          const isFavored = result.favoredStyles.includes(style)
          const isPenalized = result.penalizedStyles.includes(style)
          const cfg = STYLE_CONFIG[style]
          return (
            <div key={style} className="flex flex-col items-center gap-1">
              <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded w-full text-center ${cfg.chip}`}>
                {style}
              </span>
              <span className={`text-xs font-bold ${bonus > 0 ? 'text-green-400' : bonus < 0 ? 'text-red-400' : 'text-white/30'}`}>
                {bonus > 0 ? `+${bonus}` : bonus === 0 ? '±0' : `${bonus}`}
              </span>
              {isFavored && (
                <span className="text-[10px] text-green-400 font-bold leading-none">▲有利</span>
              )}
              {isPenalized && (
                <span className="text-[10px] text-red-400 font-bold leading-none">▼不利</span>
              )}
            </div>
          )
        })}
      </div>

      {/* 馬場状態テキスト */}
      <p className="text-white/50 text-xs leading-relaxed">{result.conditionNote}</p>
    </div>
  )
}

// ---- 枠順傾向パネル ----
// JRA公式枠番カラー (1枠=白・2枠=黒・3枠=赤・4枠=青・5枠=黄・6枠=緑・7枠=橙・8枠=桃)
const JRA_GATE_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: 'bg-white',        text: 'text-gray-800',  label: '1' },
  2: { bg: 'bg-gray-800',     text: 'text-white',     label: '2' },
  3: { bg: 'bg-red-600',      text: 'text-white',     label: '3' },
  4: { bg: 'bg-blue-600',     text: 'text-white',     label: '4' },
  5: { bg: 'bg-yellow-400',   text: 'text-gray-800',  label: '5' },
  6: { bg: 'bg-green-600',    text: 'text-white',     label: '6' },
  7: { bg: 'bg-orange-500',   text: 'text-white',     label: '7' },
  8: { bg: 'bg-fuchsia-500',  text: 'text-white',     label: '8' },
}

function GateTendencyPanel({ result }: { result: GateTendencyResult }) {
  const biasColor: Record<GateBias, string> = {
    '内有利':  'text-teal-300 bg-teal-400/10 border-teal-400/30',
    '外有利':  'text-violet-300 bg-violet-400/10 border-violet-400/30',
    'フラット': 'text-white/50 bg-white/5 border-white/20',
  }
  const biasIcon: Record<GateBias, string> = {
    '内有利':  '◀',
    '外有利':  '▶',
    'フラット': '⇔',
  }

  const gates = Array.from({ length: result.maxGate }, (_, i) => i + 1)

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 mb-3">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <span className="text-white/50 text-xs font-medium">枠順傾向</span>
        <span className={`text-xs font-bold border px-2 py-0.5 rounded ${biasColor[result.bias]}`}>
          {biasIcon[result.bias]} {result.bias}
        </span>
        {result.favoredGates.length > 0 && (
          <span className="text-white/40 text-xs">
            {result.favoredGates.slice(0, 4).join('・')}枠が有利
          </span>
        )}
      </div>

      {/* 枠番ビジュアル（JRA枠番カラー＋EV補正値） */}
      <div className="flex gap-1.5 mb-2.5 flex-wrap">
        {gates.map(gate => {
          const bonus = result.bonusTable[gate] ?? 0
          const color = JRA_GATE_COLORS[gate] ?? { bg: 'bg-white/20', text: 'text-white', label: String(gate) }
          const isFavored = result.favoredGates.includes(gate)
          const isPenalized = result.penalizedGates.includes(gate)
          return (
            <div key={gate} className="flex flex-col items-center gap-0.5">
              {/* 枠番バッジ */}
              <div className={`w-7 h-6 rounded text-[11px] font-bold flex items-center justify-center ${color.bg} ${color.text} ${isFavored ? 'ring-1 ring-green-400 ring-offset-1 ring-offset-black/30' : isPenalized ? 'ring-1 ring-red-400 ring-offset-1 ring-offset-black/30' : ''}`}>
                {gate}
              </div>
              {/* EV補正値 */}
              <span className={`text-[11px] font-bold leading-none ${bonus > 0 ? 'text-green-400' : bonus < 0 ? 'text-red-400' : 'text-white/25'}`}>
                {bonus > 0 ? `+${bonus}` : bonus === 0 ? '±0' : `${bonus}`}
              </span>
              {/* ▲▼ ラベル */}
              {isFavored && (
                <span className="text-[9px] text-green-400 font-bold leading-none">▲</span>
              )}
              {isPenalized && (
                <span className="text-[9px] text-red-400 font-bold leading-none">▼</span>
              )}
            </div>
          )
        })}
      </div>

      {/* 説明テキスト */}
      <p className="text-white/50 text-xs leading-relaxed">{result.note}</p>
    </div>
  )
}

// ---- 市場乖離パネル ----
function MarketDivergencePanel({ result }: { result: MarketDivergenceResult }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 mb-3">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <span className="text-white/50 text-xs font-medium">市場乖離</span>
        {result.undervalued.length > 0 && (
          <span className="text-xs font-bold border px-1.5 py-0.5 rounded text-green-300 bg-green-400/10 border-green-400/30">
            過小評価 {result.undervalued.length}頭
          </span>
        )}
        {result.overvalued.length > 0 && (
          <span className="text-xs font-bold border px-1.5 py-0.5 rounded text-red-300 bg-red-400/10 border-red-400/30">
            危険人気 {result.overvalued.length}頭
          </span>
        )}
      </div>

      {/* 馬一覧（乖離スコア降順） */}
      <div className="space-y-1">
        {result.allHorses.map(horse => {
          const cfg = MARKET_LABEL_STYLE[horse.marketLabel]
          return (
            <div key={horse.name} className="flex items-center gap-2 text-xs">
              <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded flex-shrink-0 ${cfg.chip}`}>
                {cfg.icon} {horse.marketLabel}
              </span>
              <span className="text-white/80 font-medium truncate flex-1">{horse.name}</span>
              <span className="text-white/35 flex-shrink-0">AI:{horse.aiRank}位</span>
              <span className="text-white/35 flex-shrink-0">{horse.popularity}番人気</span>
              <span className={`font-bold flex-shrink-0 w-8 text-right ${horse.divergenceScore > 0 ? 'text-green-400' : horse.divergenceScore < 0 ? 'text-red-400' : 'text-white/25'}`}>
                {horse.divergenceScore > 0 ? `+${horse.divergenceScore}` : horse.divergenceScore === 0 ? '±0' : `${horse.divergenceScore}`}
              </span>
              <span className={`font-bold flex-shrink-0 w-12 text-right ${horse.evScore > 0 ? 'text-green-400' : 'text-red-400'}`}>
                EV{horse.evScore > 0 ? `+${horse.evScore}` : horse.evScore}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- レースカード ----
function RaceCard({ race, labelRoi }: { race: Race; labelRoi?: Map<string, number> }) {
  const [recorded, setRecorded] = useState(0)
  const [raceComment, setRaceComment] = useState<RaceComment | null>(null)
  const [commentLoading, setCommentLoading] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const barWidth = normalizeScore(race.distortionScore)

  async function handleGenerateComment(force = false) {
    if (raceComment && !force) return
    setCommentLoading(true)
    setCommentError(null)
    try {
      const allHorses = race.marketDivergenceResult?.allHorses ?? []
      const body: RaceCommentInput = {
        raceId: race.id,
        raceName: race.raceName,
        venue: race.venue,
        date: race.date,
        surface: race.surface,
        distance: String(race.distance),
        grade: race.grade,
        trackCondition: race.trackCondition ?? '良',
        pace: race.pacePrediction?.pace ?? '',
        courseNote: race.courseFeature?.aiHint ?? '',
        horses: allHorses.map(h => ({
          name: h.name,
          odds: h.winOdds,
          popularity: h.popularity,
          aiRank: h.aiRank,
          aiScore: race.horses?.find(rh => rh.name === h.name)?.aiScore ?? 0,
          evScore: h.evScore,
          marketLabel: h.marketLabel,
          runningStyle: race.horses?.find(rh => rh.name === h.name)?.style ?? '',
          divergenceScore: h.divergenceScore,
        })),
        topPicks: race.picks.filter(p => p.signal === 'buy').map(p => p.horses[0]).filter(Boolean),
      }
      const res = await fetch('/api/race-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('コメント生成に失敗しました')
      setRaceComment(await res.json() as RaceComment)
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'コメント生成に失敗しました')
    } finally {
      setCommentLoading(false)
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-white font-bold text-base leading-tight">{race.raceName}</h3>
          <p className="text-white/50 text-xs mt-0.5">
            {race.date} / {race.venue} / {race.raceNumber}R / {race.surface}
            {race.distance}
          </p>
        </div>
        <span
          className={`text-xs font-bold border px-2 py-0.5 rounded flex-shrink-0 ${gradeColor(
            race.grade
          )}`}
        >
          {race.grade || 'OP'}
        </span>
      </div>

      {/* 歪みスコアバー */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-white/50">歪みスコア</span>
          <span className="text-amber-400 font-bold">
            {race.distortionScore >= 0 ? '+' : ''}
            {race.distortionScore}
          </span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* スタット行 */}
      <div className="flex gap-4 mb-3 text-xs">
        <div>
          <span className="text-white/40">EV スコア</span>
          <span
            className={`ml-1 font-bold ${
              race.evScore >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {race.evScore >= 0 ? '+' : ''}
            {race.evScore}
          </span>
        </div>
        <div>
          <span className="text-white/40">信頼度</span>
          <span className="ml-1 text-amber-400 font-medium">
            {renderStars(race.confidence)}
          </span>
        </div>
        {recorded > 0 && (
          <div>
            <span className="text-green-400 text-xs">✓ {recorded}件記録済</span>
          </div>
        )}
      </div>

      {/* コース特徴 */}
      {race.courseFeature && (
        <CourseFeaturePanel feature={race.courseFeature} />
      )}

      {/* 展開予想 */}
      {race.pacePrediction && (
        <PacePredictionPanel pred={race.pacePrediction} />
      )}

      {/* 馬場補正 */}
      {race.trackConditionResult && (
        <TrackConditionPanel result={race.trackConditionResult} />
      )}

      {/* 枠順傾向 */}
      {race.gateTendencyResult && (
        <GateTendencyPanel result={race.gateTendencyResult} />
      )}

      {/* 市場乖離 */}
      {race.marketDivergenceResult && (
        <MarketDivergencePanel result={race.marketDivergenceResult} />
      )}

      {/* ルールベース簡易コメント */}
      {race.aiComment && !raceComment && (
        <p className="text-white/50 text-xs leading-relaxed bg-white/5 rounded-xl px-3 py-2 mb-3">
          💬 {race.aiComment}
        </p>
      )}

      {/* AI コメント生成パネル */}
      <div className="mb-3">
        {raceComment ? (
          <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-xl px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-indigo-300/70 text-xs font-medium">
                AI分析コメント
                {raceComment.generatedBy === 'openai' && (
                  <span className="ml-1.5 text-[10px] text-indigo-400/50">GPT-4o-mini</span>
                )}
              </span>
              <button
                onClick={() => handleGenerateComment(true)}
                disabled={commentLoading}
                className="text-[10px] text-white/25 hover:text-white/50 transition-colors disabled:opacity-30"
              >
                {commentLoading ? '生成中...' : '再生成'}
              </button>
            </div>
            <div>
              <span className="text-green-400 text-xs font-bold">買い材料</span>
              <p className="text-white/70 text-xs leading-relaxed mt-0.5">{raceComment.positive}</p>
            </div>
            <div>
              <span className="text-red-400 text-xs font-bold">不安材料</span>
              <p className="text-white/70 text-xs leading-relaxed mt-0.5">{raceComment.concern}</p>
            </div>
            <div>
              <span className="text-amber-400 text-xs font-bold">総合判断</span>
              <p className="text-white/70 text-xs leading-relaxed mt-0.5">{raceComment.overall}</p>
            </div>
          </div>
        ) : (
          <button
            onClick={() => handleGenerateComment(false)}
            disabled={commentLoading}
            className="w-full py-2 border border-white/10 rounded-xl text-xs text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {commentLoading ? (
              <><span className="inline-block animate-spin">↻</span>AIコメント生成中...</>
            ) : (
              <>💬 AIコメントを生成（買い材料・不安材料・総合判断）</>
            )}
          </button>
        )}
        {commentError && (
          <p className="text-red-400 text-xs mt-1.5 px-1">{commentError}</p>
        )}
      </div>

      {/* 買い目提案 */}
      {race.optimizedBets && race.optimizedBets.length > 0 && (
        <OptimizedBetsPanel
          bets={race.optimizedBets}
          race={race}
          onRecorded={() => setRecorded(n => n + 1)}
        />
      )}

      {/* 買い目リスト */}
      <div className="space-y-2">
        {race.picks && race.picks.length > 0 ? (
          race.picks.map((pick, i) => (
            <PickRow
              key={i}
              pick={pick}
              race={race}
              onRecorded={() => setRecorded((n) => n + 1)}
              labelRoi={labelRoi}
            />
          ))
        ) : (
          <p className="text-white/30 text-xs text-center py-2">買い目なし</p>
        )}
      </div>
    </div>
  )
}

// ---- メインページ ----
export default function HomePage() {
  const [races, setRaces] = useState<Race[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [homeStat, setHomeStat] = useState<HomeStat | null>(null)

  useEffect(() => {
    // races と stats を並行フェッチ（stats は best-effort）
    const racesP = fetch('/api/races')
      .then(r => { if (!r.ok) throw new Error('レースデータの取得に失敗しました'); return r.json() })
      .then((data: Race[] | { races: Race[] }) => Array.isArray(data) ? data : (data.races ?? []))

    const statsP = fetch('/api/stats')
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)

    Promise.all([racesP, statsP])
      .then(([raceList, statsData]) => {
        setRaces(raceList as Race[])
        if (statsData && (statsData as HomeStat).totalBets > 0) {
          setHomeStat(statsData as HomeStat)
        }
        setLoading(false)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'エラーが発生しました'
        setError(message)
        setLoading(false)
      })
  }, [])

  // marketLabel → 過去ROI マップ（returnRate - 100）
  const labelRoi = homeStat
    ? new Map<string, number>(
        (homeStat.byMarketLabel ?? [])
          .filter(s => s.count >= 2)
          .map(s => [s.label, s.returnRate - 100])
      )
    : undefined

  const topRaces = races.slice(0, 3)
  const restRaces = races.slice(3)

  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 md:pb-8 pt-6">
      {/* ページタイトル */}
      <div className="mb-6">
        <h1 className="text-amber-400 font-bold text-2xl">おすすめレース</h1>
        <p className="text-white/50 text-sm mt-1">
          オッズ歪みと期待値で厳選したバリュー馬券候補
        </p>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* 過去成績バナー（記録データあり時のみ） */}
      {homeStat && homeStat.totalBets > 0 && (
        <div className="mb-5 bg-white/3 border border-white/8 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-white/35 text-xs font-medium">過去成績</span>
          <div className="flex items-center gap-1">
            <span className="text-white/35 text-xs">的中率</span>
            <span className={`font-bold text-sm ${homeStat.winRate >= 30 ? 'text-green-400' : 'text-white/70'}`}>
              {homeStat.winRate}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-white/35 text-xs">ROI</span>
            <span className={`font-bold text-sm ${homeStat.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {homeStat.roi >= 0 ? '+' : ''}{homeStat.roi}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-white/35 text-xs">回収率</span>
            <span className={`font-bold text-sm ${homeStat.returnRate >= 100 ? 'text-green-400' : 'text-white/70'}`}>
              {homeStat.returnRate}%
            </span>
          </div>
          <span className="text-white/25 text-xs ml-auto">{homeStat.totalBets}件の記録から</span>
        </div>
      )}

      {/* おすすめ上位3レース */}
      {!loading && !error && (
        <>
          {topRaces.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
              <p className="text-white/40 text-base">本日のレースデータがありません</p>
              <p className="text-white/30 text-sm mt-2">
                APIからデータが取得できませんでした
              </p>
            </div>
          ) : (
            <div className="space-y-4 mb-8">
              {topRaces.map((race) => (
                <RaceCard key={race.id} race={race} labelRoi={labelRoi} />
              ))}
            </div>
          )}

          {/* 全レース一覧 */}
          {restRaces.length > 0 && (
            <>
              <div className="mb-4">
                <h2 className="text-amber-400 font-bold text-lg">全レース一覧</h2>
                <p className="text-white/50 text-sm mt-0.5">
                  その他 {restRaces.length} レース
                </p>
              </div>
              <div className="space-y-4">
                {restRaces.map((race) => (
                  <RaceCard key={race.id} race={race} labelRoi={labelRoi} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
