'use client'

import { useEffect, useState } from 'react'

// ---- 型定義 ----
interface SegmentStat {
  label: string
  count: number
  winCount: number
  winRate: number
  totalAmount: number
  totalPayout: number
  returnRate: number
}

interface MonthlyStat {
  month: string
  count: number
  winCount: number
  winRate: number
  profit: number
  returnRate: number
}

interface StatsData {
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
  byPopularity: SegmentStat[]
  byAiRank: SegmentStat[]
  monthly: MonthlyStat[]
}

interface LearningStatRow {
  id: string
  venue: string
  surface: string
  betType: string
  popularityRange: string
  aiScoreRange: string
  winRate: number
  roi: number
  returnRateBonus: number
  sampleCount: number
}

// ---- ユーティリティ ----
function segRoi(seg: SegmentStat): number {
  return seg.totalAmount > 0
    ? Math.round(((seg.totalPayout - seg.totalAmount) / seg.totalAmount) * 100)
    : 0
}

function roiColor(roi: number): string {
  return roi >= 0 ? 'text-green-400' : 'text-red-400'
}

function rateColor(rate: number): string {
  return rate >= 100 ? 'text-green-400' : 'text-red-400'
}

function signStr(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

// ---- KPIカード ----
function KpiCard({
  label, value, sub, color,
}: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
      <p className="text-white/40 text-xs mb-1 leading-tight">{label}</p>
      <p className={`text-2xl font-bold leading-tight ${color ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-white/30 text-xs mt-1">{sub}</p>}
    </div>
  )
}

// ---- 月別回収率バー ----
function MonthlyReturnBar({ row, maxReturn }: { row: MonthlyStat; maxReturn: number }) {
  const pct = maxReturn > 0 ? Math.min(100, (row.returnRate / maxReturn) * 100) : 0
  const isProfit = row.returnRate >= 100
  return (
    <div className="flex items-center gap-3">
      <span className="text-white/50 text-xs w-14 flex-shrink-0 tabular-nums">{row.month.slice(2)}</span>
      <div className="flex-1 h-6 bg-white/5 rounded overflow-hidden relative">
        <div
          className={`h-full rounded transition-all ${isProfit ? 'bg-green-500/35' : 'bg-red-500/25'}`}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute inset-0 flex items-center px-2 gap-2">
          <span className={`text-xs font-bold ${rateColor(row.returnRate)}`}>
            {row.returnRate}%
          </span>
          <span className="text-white/30 text-[10px]">{row.count}件</span>
        </div>
      </div>
      <span
        className={`text-xs font-medium w-24 text-right flex-shrink-0 tabular-nums ${
          row.profit >= 0 ? 'text-green-400' : 'text-red-400'
        }`}
      >
        {row.profit >= 0 ? '+' : ''}{row.profit.toLocaleString()}円
      </span>
    </div>
  )
}

// ---- 馬券種別ROIバー ----
function BetTypeRoiBar({ stat }: { stat: SegmentStat }) {
  const roi = segRoi(stat)
  const isProfit = stat.returnRate >= 100
  const barPct = Math.min(100, stat.returnRate / 2)
  return (
    <div className="flex items-center gap-3">
      <span className="text-white/70 text-xs font-medium w-10 flex-shrink-0 bg-white/10 px-1.5 py-0.5 rounded text-center">
        {stat.label}
      </span>
      <div className="flex-1 h-6 bg-white/5 rounded overflow-hidden relative">
        <div
          className={`h-full rounded transition-all ${isProfit ? 'bg-emerald-500/35' : 'bg-rose-500/25'}`}
          style={{ width: `${barPct}%` }}
        />
        <div className="absolute inset-0 flex items-center px-2 gap-2">
          <span className={`text-xs font-bold ${rateColor(stat.returnRate)}`}>
            {stat.returnRate}%
          </span>
          <span className={`text-[10px] ${roiColor(roi)}`}>
            ROI {signStr(roi)}%
          </span>
        </div>
      </div>
      <span className="text-white/30 text-xs w-12 text-right flex-shrink-0">{stat.count}件</span>
    </div>
  )
}

// ---- AI補正テーブル ----
type CorrRow = { label: string; roi: number; bonus: number; sampleCount: number }
type CorrSection = { title: string; rows: CorrRow[] }

function buildCorrSections(stats: LearningStatRow[]): CorrSection[] {
  const enough = stats.filter(s => s.sampleCount >= 5)

  const pop = enough.filter(
    s => s.popularityRange && !s.venue && !s.surface && !s.betType && !s.aiScoreRange
  )
  const ai = enough.filter(
    s => s.aiScoreRange && !s.venue && !s.surface && !s.betType && !s.popularityRange
  )
  const venue = enough.filter(
    s => s.venue && !s.surface && !s.betType && !s.popularityRange && !s.aiScoreRange
  )
  const surface = enough.filter(
    s => s.surface && !s.venue && !s.betType && !s.popularityRange && !s.aiScoreRange
  )
  const betType = enough.filter(
    s => s.betType && !s.venue && !s.surface && !s.popularityRange && !s.aiScoreRange
  )

  const toRow = (s: LearningStatRow, label: string): CorrRow => ({
    label, roi: s.roi, bonus: s.returnRateBonus, sampleCount: s.sampleCount,
  })

  return [
    { title: '人気帯別', rows: pop.map(s => toRow(s, s.popularityRange)) },
    { title: 'AIスコア帯別', rows: ai.map(s => toRow(s, s.aiScoreRange)) },
    {
      title: '競馬場別',
      rows: venue
        .map(s => toRow(s, s.venue))
        .sort((a, b) => Math.abs(b.bonus) - Math.abs(a.bonus)),
    },
    { title: '馬場別', rows: surface.map(s => toRow(s, s.surface)) },
    { title: '馬券種別', rows: betType.map(s => toRow(s, s.betType)) },
  ].filter(s => s.rows.length > 0)
}

function CorrectionTable({ section }: { section: CorrSection }) {
  return (
    <div className="mb-4">
      <p className="text-white/55 text-xs font-semibold mb-2">{section.title}</p>
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-3 py-2 text-white/35 font-medium">区分</th>
              <th className="text-right px-3 py-2 text-white/35 font-medium">件数</th>
              <th className="text-right px-3 py-2 text-white/35 font-medium">ROI</th>
              <th className="text-right px-3 py-2 text-white/35 font-medium">補正値</th>
              <th className="text-center px-3 py-2 text-white/35 font-medium">AIスコアへの影響</th>
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, i) => (
              <tr key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-3 py-2">
                  <span className="text-white/80 font-medium bg-white/10 px-1.5 py-0.5 rounded">
                    {row.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-white/50 tabular-nums">{row.sampleCount}件</td>
                <td className={`px-3 py-2 text-right font-bold tabular-nums ${roiColor(row.roi)}`}>
                  {signStr(row.roi)}%
                </td>
                <td
                  className={`px-3 py-2 text-right font-bold tabular-nums ${
                    row.bonus > 0 ? 'text-green-400' : row.bonus < 0 ? 'text-red-400' : 'text-white/30'
                  }`}
                >
                  {row.bonus > 0 ? `+${row.bonus}` : row.bonus === 0 ? '±0' : row.bonus}
                </td>
                <td className="px-3 py-2 text-center">
                  {row.bonus >= 5 ? (
                    <span className="text-green-400 font-bold text-xs">↑↑ 大幅有利</span>
                  ) : row.bonus > 0 ? (
                    <span className="text-green-400 text-xs">↑ 有利</span>
                  ) : row.bonus <= -5 ? (
                    <span className="text-red-400 font-bold text-xs">↓↓ 大幅不利</span>
                  ) : row.bonus < 0 ? (
                    <span className="text-red-400 text-xs">↓ 不利</span>
                  ) : (
                    <span className="text-white/25 text-xs">→ 中立</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---- メインページ ----
export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [learningStats, setLearningStats] = useState<LearningStatRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/stats').then(r => r.ok ? r.json() : null),
      fetch('/api/learning?format=raw').then(r => r.ok ? r.json() : []),
    ])
      .then(([s, ls]) => {
        if (s) setStats(s as StatsData)
        if (Array.isArray(ls)) setLearningStats(ls as LearningStatRow[])
      })
      .finally(() => setLoading(false))
  }, [])

  // ---- データ導出 ----
  const honmeiStat = stats?.byAiRank?.find(s => s.label === 'AI1位')
  const anaStat = stats?.byPopularity?.find(s => s.label === '7番人気以上')
  const taikoStat = stats?.byAiRank?.find(s => s.label === 'AI2位')
  const lastMonth = stats?.monthly?.[stats.monthly.length - 1]

  const honmeiRoi = honmeiStat ? segRoi(honmeiStat) : null
  const anaRoi = anaStat ? segRoi(anaStat) : null

  const maxMonthlyReturn = Math.max(
    150,
    ...(stats?.monthly?.map(m => m.returnRate) ?? [])
  )

  const corrSections = buildCorrSections(learningStats)
  const hasLearning = learningStats.some(s => s.sampleCount >= 5)

  // ---- ローディング ----
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 pb-24 md:pb-8 pt-6">
        <div className="h-8 bg-white/10 rounded w-48 mb-6 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 h-20 animate-pulse" />
          ))}
        </div>
        <div className="h-40 bg-white/5 border border-white/10 rounded-xl animate-pulse mb-8" />
      </div>
    )
  }

  // ---- データなし ----
  if (!stats || stats.totalBets === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 pb-24 md:pb-8 pt-6">
        <div className="mb-6">
          <h1 className="text-amber-400 font-bold text-2xl">ダッシュボード</h1>
          <p className="text-white/50 text-sm mt-1">収支・ROI・AI補正の統合サマリー</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-white/40 text-base">まだデータがありません</p>
          <p className="text-white/30 text-sm mt-2">
            馬券を記録して結果を入力するとダッシュボードが表示されます
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 md:pb-8 pt-6">
      {/* ページタイトル */}
      <div className="mb-6">
        <h1 className="text-amber-400 font-bold text-2xl">ダッシュボード</h1>
        <p className="text-white/50 text-sm mt-1">収支・ROI・AI補正の統合サマリー</p>
      </div>

      {/* セクション1: KPIカード */}
      <section className="mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 本命ROI */}
          {honmeiStat && (
            <KpiCard
              label={`本命ROI（AI1位 ${honmeiStat.count}件）`}
              value={`${honmeiRoi !== null ? signStr(honmeiRoi) : '-'}%`}
              sub={`回収率 ${honmeiStat.returnRate}%`}
              color={honmeiRoi !== null ? roiColor(honmeiRoi) : 'text-white/50'}
            />
          )}

          {/* 穴馬ROI */}
          {anaStat && (
            <KpiCard
              label={`穴馬ROI（7人気+ ${anaStat.count}件）`}
              value={`${anaRoi !== null ? signStr(anaRoi) : '-'}%`}
              sub={`回収率 ${anaStat.returnRate}%`}
              color={anaRoi !== null ? roiColor(anaRoi) : 'text-white/50'}
            />
          )}

          {/* 全体ROI */}
          <KpiCard
            label={`全体ROI（${stats.totalBets}件）`}
            value={`${signStr(stats.roi)}%`}
            sub={`回収率 ${stats.returnRate}% / 的中${stats.winRate}%`}
            color={roiColor(stats.roi)}
          />

          {/* 今月回収率 */}
          {lastMonth ? (
            <KpiCard
              label={`今月回収率（${lastMonth.month}）`}
              value={`${lastMonth.returnRate}%`}
              sub={`${lastMonth.profit >= 0 ? '+' : ''}${lastMonth.profit.toLocaleString()}円 / ${lastMonth.count}件`}
              color={rateColor(lastMonth.returnRate)}
            />
          ) : (
            <KpiCard
              label="対抗ROI（AI2位）"
              value={taikoStat ? `${signStr(segRoi(taikoStat))}%` : '-'}
              sub={taikoStat ? `回収率 ${taikoStat.returnRate}%` : ''}
              color={taikoStat ? roiColor(segRoi(taikoStat)) : 'text-white/50'}
            />
          )}
        </div>
      </section>

      {/* セクション2: 月別回収率 */}
      {stats.monthly && stats.monthly.length > 0 && (
        <section className="mb-8">
          <h2 className="text-amber-400 font-bold text-lg mb-3">月別回収率</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 space-y-2">
            {stats.monthly.slice().reverse().map(row => (
              <MonthlyReturnBar key={row.month} row={row} maxReturn={maxMonthlyReturn} />
            ))}
          </div>
        </section>
      )}

      {/* セクション3: 馬券種別ROI */}
      {stats.byBetType && stats.byBetType.some(s => s.count > 0) && (
        <section className="mb-8">
          <h2 className="text-amber-400 font-bold text-lg mb-3">馬券種別ROI</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 space-y-2.5">
            {stats.byBetType.filter(s => s.count > 0).map(stat => (
              <BetTypeRoiBar key={stat.label} stat={stat} />
            ))}
          </div>
        </section>
      )}

      {/* セクション4: AI補正前後比較 */}
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-amber-400 font-bold text-lg">AI補正効果</h2>
          {!hasLearning && (
            <span className="text-white/35 text-xs border border-white/15 px-2 py-0.5 rounded">
              5件以上の決着データが必要
            </span>
          )}
        </div>
        <p className="text-white/40 text-xs mb-4">
          決着済み馬券から学習したセグメント別ROIが、次回レースのAIスコアに補正値（±ポイント）として加算されます。
          結果入力 → 自動再計算 → 次回の予想に反映。
        </p>

        {!hasLearning ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
            <p className="text-white/40 text-sm">まだ学習データがありません</p>
            <p className="text-white/25 text-xs mt-1">
              結果入力を行うとAI補正が自動計算され、次回の予想スコアに反映されます
            </p>
          </div>
        ) : (
          corrSections.map(section => (
            <CorrectionTable key={section.title} section={section} />
          ))
        )}
      </section>
    </div>
  )
}
