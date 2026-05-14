'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const StatsCharts = dynamic(() => import('./StatsCharts'), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      {[1, 2, 3].map(i => (
        <div key={i} className={`bg-white/5 border border-white/10 rounded-xl h-52 animate-pulse ${i === 3 ? 'md:col-span-2' : ''}`} />
      ))}
    </div>
  ),
})

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

interface DailyStat {
  date: string
  count: number
  winCount: number
  winRate: number
  profit: number
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
  byScoreRange: SegmentStat[]
  byVenue: SegmentStat[]
  bySurface: SegmentStat[]
  byTrackCondition: SegmentStat[]
  byPopularity: SegmentStat[]
  byAiRank: SegmentStat[]
  byPaceType: SegmentStat[]
  byMarketLabel: SegmentStat[]
  byEvRange: SegmentStat[]
  byRunningStyle?: SegmentStat[]
  daily: DailyStat[]
  monthly: MonthlyStat[]
}

interface LearningSegment {
  key: string
  label: string
  count: number
  winRate: number
  returnRate: number
  avgProfit: number
  isInsufficient: boolean
  correction: number
}

interface LearningModel {
  byVenue: LearningSegment[]
  bySurface: LearningSegment[]
  byTrackCondition: LearningSegment[]
  byRunningStyle: LearningSegment[]
  byPopularityRange: LearningSegment[]
  byAiScoreRange: LearningSegment[]
  byEvRange: LearningSegment[]
  byMarketLabel: LearningSegment[]
  byBetType: LearningSegment[]
  byPaceType: LearningSegment[]
  totalSamples: number
  isInsufficient: boolean
  updatedAt: string
}

interface CommentSection {
  title: string
  content: string
  type: 'good' | 'warning' | 'neutral' | 'tip'
}

interface AiCommentData {
  sections: CommentSection[]
  generatedBy: 'rule' | 'openai'
}

// ---- ユーティリティ ----
function pct(value: number): string {
  return `${value.toFixed(1)}%`
}

function profitText(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toLocaleString()}円`
}

function rateColor(rate: number): string {
  return rate >= 100 ? 'text-green-400' : 'text-red-400'
}

function profitColor(value: number): string {
  return value >= 0 ? 'text-green-400' : 'text-red-400'
}

// ---- スタットカード ----
function StatCard({ label, value, sub, colorClass }: {
  label: string; value: string; sub?: string; colorClass?: string
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
      <p className="text-white/50 text-xs mb-1">{label}</p>
      <p className={`text-xl font-bold ${colorClass ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-white/30 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

// ---- セクションタイトル ----
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-amber-400 font-bold text-lg mb-3">{children}</h2>
}

// ---- テーブル共通ラッパー ----
function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-8">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-2.5 text-white/40 text-xs font-medium border-b border-white/10 whitespace-nowrap">
      {children}
    </th>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-2.5 text-white/80 text-sm whitespace-nowrap ${className ?? ''}`}>
      {children}
    </td>
  )
}

// ---- 汎用セグメントテーブル ----
function SegmentTable({ stats }: { stats: SegmentStat[] }) {
  const rows = stats.filter(r => r.count > 0)
  if (rows.length === 0) return null
  return (
    <TableWrapper>
      <thead>
        <tr>
          <Th>区分</Th>
          <Th>件数</Th>
          <Th>的中率</Th>
          <Th>回収率</Th>
          <Th>ROI</Th>
          <Th>収支</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const profit = row.totalPayout - row.totalAmount
          const roi = row.totalAmount > 0 ? Math.round(((row.totalPayout - row.totalAmount) / row.totalAmount) * 100) : 0
          return (
            <tr key={row.label} className="border-t border-white/5 hover:bg-white/5 transition-colors">
              <Td>
                <span className="text-white font-medium bg-white/10 px-2 py-0.5 rounded text-xs">{row.label}</span>
              </Td>
              <Td>
                {row.count}件
                <span className="text-white/40 text-xs ml-1">({row.winCount}的中)</span>
              </Td>
              <Td>{pct(row.winRate)}</Td>
              <Td className={rateColor(row.returnRate)}>{pct(row.returnRate)}</Td>
              <Td className={roi >= 0 ? 'text-green-400' : 'text-red-400'}>{roi >= 0 ? '+' : ''}{roi}%</Td>
              <Td className={profitColor(profit)}>{profitText(profit)}</Td>
            </tr>
          )
        })}
      </tbody>
    </TableWrapper>
  )
}

// ---- AI分析テーブル（マーケットラベル強調） ----
const MARKET_LABEL_COLOR: Record<string, string> = {
  '妙味あり':  'text-teal-300 bg-teal-400/15 border-teal-400/40',
  '過小評価':  'text-green-300 bg-green-400/15 border-green-400/40',
  '危険人気馬': 'text-red-300 bg-red-400/15 border-red-400/40',
  '本命候補':  'text-amber-300 bg-amber-400/15 border-amber-400/40',
  '標準':     'text-white/50 bg-white/5 border-white/15',
}

function MarketLabelTable({ stats }: { stats: SegmentStat[] }) {
  const rows = stats.filter(r => r.count > 0)
  if (rows.length === 0) return null
  return (
    <TableWrapper>
      <thead>
        <tr>
          <Th>市場評価</Th>
          <Th>件数</Th>
          <Th>的中率</Th>
          <Th>回収率</Th>
          <Th>ROI</Th>
          <Th>収支</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const profit = row.totalPayout - row.totalAmount
          const roi = row.totalAmount > 0 ? Math.round(((row.totalPayout - row.totalAmount) / row.totalAmount) * 100) : 0
          const chipStyle = MARKET_LABEL_COLOR[row.label] ?? 'text-white/50 bg-white/5 border-white/15'
          return (
            <tr key={row.label} className="border-t border-white/5 hover:bg-white/5 transition-colors">
              <Td>
                <span className={`text-xs font-bold border px-2 py-0.5 rounded ${chipStyle}`}>{row.label}</span>
              </Td>
              <Td>
                {row.count}件
                <span className="text-white/40 text-xs ml-1">({row.winCount}的中)</span>
              </Td>
              <Td>{pct(row.winRate)}</Td>
              <Td className={rateColor(row.returnRate)}>{pct(row.returnRate)}</Td>
              <Td className={roi >= 0 ? 'text-green-400' : 'text-red-400'}>{roi >= 0 ? '+' : ''}{roi}%</Td>
              <Td className={profitColor(profit)}>{profitText(profit)}</Td>
            </tr>
          )
        })}
      </tbody>
    </TableWrapper>
  )
}

// ---- 学習モデルテーブル ----
function LearningSegmentTable({ segments }: { segments: LearningSegment[] }) {
  const rows = segments.filter(s => s.count > 0)
  if (rows.length === 0) return null
  return (
    <TableWrapper>
      <thead>
        <tr>
          <Th>区分</Th>
          <Th>件数</Th>
          <Th>的中率</Th>
          <Th>回収率</Th>
          <Th>学習補正</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(seg => (
          <tr key={seg.key} className="border-t border-white/5 hover:bg-white/5 transition-colors">
            <Td>
              <span className="text-white font-medium bg-white/10 px-2 py-0.5 rounded text-xs">{seg.label}</span>
            </Td>
            <Td>{seg.count}件</Td>
            <Td>{seg.isInsufficient ? <span className="text-white/30">–</span> : `${seg.winRate}%`}</Td>
            <Td className={seg.isInsufficient ? 'text-white/30' : rateColor(seg.returnRate)}>
              {seg.isInsufficient ? '–' : `${seg.returnRate}%`}
            </Td>
            <Td>
              {seg.isInsufficient
                ? <span className="text-amber-400/70 text-xs">参考データ不足</span>
                : seg.correction > 0.1
                  ? <span className="text-green-400 text-xs font-bold">↑ 有利</span>
                  : seg.correction < -0.1
                    ? <span className="text-red-400 text-xs font-bold">↓ 不利</span>
                    : <span className="text-white/40 text-xs">→ 中立</span>
              }
            </Td>
          </tr>
        ))}
      </tbody>
    </TableWrapper>
  )
}

// ---- AI分析コメント ----
const COMMENT_STYLE: Record<CommentSection['type'], { border: string; bg: string; label: string; dot: string }> = {
  good:    { border: 'border-green-500/30',  bg: 'bg-green-500/10',  label: 'text-green-400',  dot: 'bg-green-400' },
  warning: { border: 'border-amber-500/30',  bg: 'bg-amber-500/10',  label: 'text-amber-400',  dot: 'bg-amber-400' },
  neutral: { border: 'border-white/10',      bg: 'bg-white/5',       label: 'text-white/60',   dot: 'bg-white/30' },
  tip:     { border: 'border-violet-500/30', bg: 'bg-violet-500/10', label: 'text-violet-400', dot: 'bg-violet-400' },
}

function AiCommentSection({ data, loading }: { data: AiCommentData | null; loading: boolean }) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>AI分析コメント</SectionTitle>
        {data && (
          <span className="text-xs px-2 py-0.5 rounded border border-white/15 text-white/40">
            {data.generatedBy === 'openai' ? 'OpenAI生成' : 'ルールベース'}
          </span>
        )}
      </div>
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 animate-pulse">
              <div className="h-2.5 bg-white/10 rounded w-1/3 mb-3" />
              <div className="h-3.5 bg-white/10 rounded w-full mb-2" />
              <div className="h-3.5 bg-white/10 rounded w-4/5" />
            </div>
          ))}
        </div>
      )}
      {!loading && data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.sections.map((sec, i) => {
            const style = COMMENT_STYLE[sec.type] ?? COMMENT_STYLE.neutral
            return (
              <div key={i} className={`border ${style.border} ${style.bg} rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                  <p className={`text-xs font-semibold ${style.label}`}>{sec.title}</p>
                </div>
                <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line">{sec.content}</p>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ---- メインページ ----
export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aiComment, setAiComment] = useState<AiCommentData | null>(null)
  const [aiCommentLoading, setAiCommentLoading] = useState(false)
  const [learning, setLearning] = useState<LearningModel | null>(null)

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => {
        if (!r.ok) throw new Error('統計データの取得に失敗しました')
        return r.json()
      })
      .then((data: StatsData) => {
        setStats(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'エラーが発生しました'
        setError(message)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetch('/api/learning')
      .then(r => r.json())
      .then((data: LearningModel) => setLearning(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!stats || stats.totalBets === 0) return
    setAiCommentLoading(true)
    fetch('/api/ai-comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stats),
    })
      .then((r) => r.json())
      .then((data: AiCommentData) => {
        setAiComment(data)
        setAiCommentLoading(false)
      })
      .catch(() => setAiCommentLoading(false))
  }, [stats])

  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 md:pb-8 pt-6">
      {/* ページタイトル */}
      <div className="mb-6">
        <h1 className="text-amber-400 font-bold text-2xl">統計・分析</h1>
        <p className="text-white/50 text-sm mt-1">馬券成績の分析とAIスコアの検証</p>
      </div>

      {/* エラー */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 animate-pulse">
                <div className="h-3 bg-white/10 rounded w-1/2 mb-3" />
                <div className="h-6 bg-white/10 rounded w-2/3" />
              </div>
            ))}
          </div>
          <div className="h-40 bg-white/5 border border-white/10 rounded-xl animate-pulse" />
        </div>
      )}

      {/* データゼロ */}
      {!loading && !error && stats && stats.totalBets === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-white/40 text-base">まだデータがありません</p>
          <p className="text-white/30 text-sm mt-2">馬券を記録して結果を入力すると統計が表示されます</p>
        </div>
      )}

      {/* 統計コンテンツ */}
      {!loading && !error && stats && stats.totalBets > 0 && (
        <>
          {/* AI分析コメント */}
          <AiCommentSection data={aiComment} loading={aiCommentLoading} />

          {/* セクション1: 総合成績 */}
          <section className="mb-8">
            <SectionTitle>総合成績</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard
                label="総レース数"
                value={`${stats.totalRaces}レース`}
                sub={`購入 ${stats.totalBets}件`}
              />
              <StatCard
                label="的中率"
                value={pct(stats.winRate)}
                sub={`${stats.totalWins}的中 / ${stats.totalBets}件`}
                colorClass={stats.winRate >= 30 ? 'text-green-400' : 'text-white'}
              />
              <StatCard
                label="回収率"
                value={pct(stats.returnRate)}
                sub="払戻 ÷ 投資 × 100"
                colorClass={rateColor(stats.returnRate)}
              />
              <StatCard
                label="ROI"
                value={`${stats.roi >= 0 ? '+' : ''}${stats.roi}%`}
                sub="収支 ÷ 投資 × 100"
                colorClass={stats.roi >= 0 ? 'text-green-400' : 'text-red-400'}
              />
              <StatCard
                label="総投資額"
                value={`${stats.totalAmount.toLocaleString()}円`}
                sub={`払戻 ${stats.totalPayout.toLocaleString()}円`}
              />
              <StatCard
                label="総収支"
                value={profitText(stats.totalProfit)}
                colorClass={profitColor(stats.totalProfit)}
              />
            </div>
          </section>

          {/* セクション2: グラフ */}
          <section className="mb-8">
            <SectionTitle>収支グラフ</SectionTitle>
            <StatsCharts
              daily={stats.daily}
              monthly={stats.monthly}
              byBetType={stats.byBetType}
            />
          </section>

          {/* セクション3: AI分析統計 — 市場評価別 */}
          {stats.byMarketLabel && stats.byMarketLabel.length > 0 && (
            <section className="mb-8">
              <SectionTitle>AI分析 — 市場評価別成績</SectionTitle>
              <p className="text-white/40 text-xs mb-3">妙味あり・危険人気馬など、AIの市場評価ラベル別の回収率</p>
              <MarketLabelTable stats={stats.byMarketLabel} />
            </section>
          )}

          {/* セクション4: AI分析統計 — EV別 */}
          {stats.byEvRange && stats.byEvRange.length > 0 && (
            <section className="mb-8">
              <SectionTitle>AI分析 — EV別成績</SectionTitle>
              <p className="text-white/40 text-xs mb-3">期待値スコア別の的中率・回収率</p>
              <SegmentTable stats={stats.byEvRange} />
            </section>
          )}

          {/* セクション5: 馬券種別成績 */}
          {stats.byBetType && stats.byBetType.some(r => r.count > 0) && (
            <section className="mb-8">
              <SectionTitle>馬券種別成績</SectionTitle>
              <SegmentTable stats={stats.byBetType} />
            </section>
          )}

          {/* セクション6: AIスコア別成績 */}
          {stats.byScoreRange && stats.byScoreRange.some(r => r.count > 0) && (
            <section className="mb-8">
              <SectionTitle>AIスコア別成績</SectionTitle>
              <SegmentTable stats={stats.byScoreRange} />
            </section>
          )}

          {/* セクション7: コース・会場別成績 */}
          {stats.byVenue && stats.byVenue.length > 0 && (
            <section className="mb-8">
              <SectionTitle>コース・会場別成績</SectionTitle>
              <SegmentTable stats={stats.byVenue} />
            </section>
          )}

          {/* セクション8: 芝・ダート別成績 */}
          {stats.bySurface && stats.bySurface.length > 0 && (
            <section className="mb-8">
              <SectionTitle>芝・ダート別成績</SectionTitle>
              <SegmentTable stats={stats.bySurface} />
            </section>
          )}

          {/* セクション9: 馬場状態別成績 */}
          {stats.byTrackCondition && stats.byTrackCondition.length > 0 && (
            <section className="mb-8">
              <SectionTitle>馬場状態別成績</SectionTitle>
              <SegmentTable stats={stats.byTrackCondition} />
            </section>
          )}

          {/* セクション10: 人気別成績 */}
          {stats.byPopularity && stats.byPopularity.length > 0 && (
            <section className="mb-8">
              <SectionTitle>人気別成績</SectionTitle>
              <SegmentTable stats={stats.byPopularity} />
            </section>
          )}

          {/* セクション11: AIランク別成績 */}
          {stats.byAiRank && stats.byAiRank.length > 0 && (
            <section className="mb-8">
              <SectionTitle>AIランク別成績</SectionTitle>
              <SegmentTable stats={stats.byAiRank} />
            </section>
          )}

          {/* セクション12: 展開予想別成績 */}
          {stats.byPaceType && stats.byPaceType.length > 0 && (
            <section className="mb-8">
              <SectionTitle>展開予想別成績</SectionTitle>
              <SegmentTable stats={stats.byPaceType} />
            </section>
          )}

          {/* セクション12b: 脚質別成績 */}
          {stats.byRunningStyle && stats.byRunningStyle.length > 0 && (
            <section className="mb-8">
              <SectionTitle>脚質別成績</SectionTitle>
              <p className="text-white/40 text-xs mb-3">馬券購入時の本命馬の脚質別・的中率・回収率</p>
              <SegmentTable stats={stats.byRunningStyle} />
            </section>
          )}

          {/* セクション13: 日別推移 */}
          {stats.daily && stats.daily.length > 0 && (
            <section className="mb-8">
              <SectionTitle>日別推移（直近30日）</SectionTitle>
              <TableWrapper>
                <thead>
                  <tr>
                    <Th>日付</Th>
                    <Th>件数</Th>
                    <Th>的中率</Th>
                    <Th>回収率</Th>
                    <Th>収支</Th>
                  </tr>
                </thead>
                <tbody>
                  {stats.daily.slice().reverse().map((row) => (
                    <tr key={row.date} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      <Td className="text-white/60">{row.date}</Td>
                      <Td>
                        {row.count}件
                        <span className="text-white/40 text-xs ml-1">({row.winCount}的中)</span>
                      </Td>
                      <Td>{pct(row.winRate)}</Td>
                      <Td className={rateColor(row.returnRate)}>{pct(row.returnRate)}</Td>
                      <Td className={profitColor(row.profit)}>{profitText(row.profit)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            </section>
          )}

          {/* セクション14: 月別推移 */}
          {stats.monthly && stats.monthly.length > 0 && (
            <section className="mb-8">
              <SectionTitle>月別推移</SectionTitle>
              <TableWrapper>
                <thead>
                  <tr>
                    <Th>月</Th>
                    <Th>件数</Th>
                    <Th>的中率</Th>
                    <Th>回収率</Th>
                    <Th>収支</Th>
                  </tr>
                </thead>
                <tbody>
                  {stats.monthly.slice().reverse().map((row) => (
                    <tr key={row.month} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      <Td className="text-white/60 font-medium">{row.month}</Td>
                      <Td>
                        {row.count}件
                        <span className="text-white/40 text-xs ml-1">({row.winCount}的中)</span>
                      </Td>
                      <Td>{pct(row.winRate)}</Td>
                      <Td className={rateColor(row.returnRate)}>{pct(row.returnRate)}</Td>
                      <Td className={profitColor(row.profit)}>{profitText(row.profit)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            </section>
          )}
        </>
      )}

      {/* 過去データ学習モデル（settled bets が0件でも表示） */}
      {learning && (
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <SectionTitle>過去データ学習モデル</SectionTitle>
            <span className={`text-xs px-2 py-0.5 rounded border ${
              learning.isInsufficient
                ? 'text-amber-400 bg-amber-400/10 border-amber-400/30'
                : 'text-white/40 bg-white/5 border-white/10'
            }`}>
              {learning.isInsufficient
                ? `参考データ不足（決着済み ${learning.totalSamples}件）`
                : `${learning.totalSamples}件の決着データに基づく補正`
              }
            </span>
          </div>
          <p className="text-white/40 text-xs mb-5">
            回収率100%超のセグメントは買い目最適化で有利補正（↑）、100%未満は不利補正（↓）として反映されます。5件未満は補正なし。
          </p>

          {[
            { title: '競馬場別',     segments: learning.byVenue },
            { title: '馬場状態別',   segments: learning.byTrackCondition },
            { title: '脚質別',       segments: learning.byRunningStyle },
            { title: '市場評価別',   segments: learning.byMarketLabel },
            { title: 'AIスコア帯別', segments: learning.byAiScoreRange },
            { title: 'EV帯別',       segments: learning.byEvRange },
          ]
            .filter(({ segments }) => segments.some(s => s.count > 0))
            .map(({ title, segments }) => (
              <div key={title} className="mb-5">
                <p className="text-white/55 text-xs font-semibold mb-2">{title}</p>
                <LearningSegmentTable segments={segments} />
              </div>
            ))
          }

          {learning.byVenue.every(s => s.count === 0) &&
           learning.byRunningStyle.every(s => s.count === 0) && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
              <p className="text-white/40 text-sm">まだ決着済みデータがありません</p>
              <p className="text-white/25 text-xs mt-1">馬券を記録して結果を入力すると学習が始まります</p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
