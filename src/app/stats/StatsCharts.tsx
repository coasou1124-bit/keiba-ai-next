'use client'

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

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

interface SegmentStat {
  label: string
  count: number
  winCount: number
  winRate: number
  totalAmount: number
  totalPayout: number
  returnRate: number
}

interface Props {
  daily: DailyStat[]
  monthly: MonthlyStat[]
  byBetType: SegmentStat[]
}

const TICK = 'rgba(255,255,255,0.3)'
const GRID = 'rgba(255,255,255,0.07)'
const POS = '#4ade80'
const NEG = '#f87171'
const AMBER = '#fbbf24'
const TOOLTIP_CONTENT: React.CSSProperties = {
  background: '#0d0d1a',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  fontSize: 12,
  color: 'rgba(255,255,255,0.85)',
}
const TOOLTIP_LABEL: React.CSSProperties = {
  color: 'rgba(255,255,255,0.45)',
  marginBottom: 2,
  fontSize: 11,
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-white/40 text-xs font-medium mb-3">{title}</p>
      {children}
    </div>
  )
}

// ---- 日別収支バーチャート ----
function DailyProfitChart({ data }: { data: DailyStat[] }) {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length === 0) return <p className="text-white/30 text-xs py-8 text-center">データなし</p>
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={sorted} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => v.slice(5).replace('-', '/')}
          tick={{ fill: TICK, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: TICK, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${Math.round(v / 1000)}k`}
          width={38}
        />
        <Tooltip
          contentStyle={TOOLTIP_CONTENT}
          labelStyle={TOOLTIP_LABEL}
          formatter={(v) => { const n = Number(v ?? 0); return [`${n >= 0 ? '+' : ''}${n.toLocaleString()}円`, '収支'] }}
        />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
        <Bar dataKey="profit" radius={[3, 3, 0, 0]} maxBarSize={32}>
          {sorted.map((entry, i) => (
            <Cell key={i} fill={entry.profit >= 0 ? POS : NEG} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---- 累積収支ラインチャート（月別） ----
function CumulativeProfitChart({ data }: { data: MonthlyStat[] }) {
  const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month))
  if (sorted.length === 0) return <p className="text-white/30 text-xs py-8 text-center">データなし</p>
  let cum = 0
  const cumulativeData = sorted.map(d => {
    cum += d.profit
    return { month: d.month, cumulative: cum }
  })
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={cumulativeData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={(v: string) => v.slice(2).replace('-', '/')}
          tick={{ fill: TICK, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: TICK, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${Math.round(v / 1000)}k`}
          width={38}
        />
        <Tooltip
          contentStyle={TOOLTIP_CONTENT}
          labelStyle={TOOLTIP_LABEL}
          formatter={(v) => { const n = Number(v ?? 0); return [`${n >= 0 ? '+' : ''}${n.toLocaleString()}円`, '累積収支'] }}
        />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
        <Line
          type="monotone"
          dataKey="cumulative"
          stroke={AMBER}
          strokeWidth={2.5}
          dot={{ fill: AMBER, r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: AMBER, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---- 馬券種別ROIバーチャート ----
function BetTypeRoiChart({ data }: { data: SegmentStat[] }) {
  const chartData = data
    .filter(d => d.count > 0)
    .map(d => ({
      name: d.label,
      roi: d.totalAmount > 0 ? Math.round(((d.totalPayout - d.totalAmount) / d.totalAmount) * 100) : 0,
    }))
  if (chartData.length === 0) return <p className="text-white/30 text-xs py-8 text-center">データなし</p>
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: TICK, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: TICK, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}%`}
          width={38}
        />
        <Tooltip
          contentStyle={TOOLTIP_CONTENT}
          labelStyle={TOOLTIP_LABEL}
          formatter={(v) => { const n = Number(v ?? 0); return [`${n >= 0 ? '+' : ''}${n}%`, 'ROI'] }}
        />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
        <Bar dataKey="roi" radius={[3, 3, 0, 0]} maxBarSize={48}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.roi >= 0 ? POS : NEG} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function StatsCharts({ daily, monthly, byBetType }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      <ChartCard title="日別収支（直近30日）">
        <DailyProfitChart data={daily} />
      </ChartCard>
      <ChartCard title="累積収支（月別）">
        <CumulativeProfitChart data={monthly} />
      </ChartCard>
      <div className="md:col-span-2">
        <ChartCard title="馬券種別 ROI">
          <BetTypeRoiChart data={byBetType} />
        </ChartCard>
      </div>
    </div>
  )
}
