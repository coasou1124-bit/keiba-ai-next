'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

interface LocalRace {
  id: string; raceDate: string; venue: string; raceNumber: number
  analysis?: {
    horses: { horseName: string; aiScore: number; decision: string }[]
    honmei: string[]; miokuri: boolean
  }
  result?: { isHit: boolean; stake: number; payout: number; profit: number }
}

function bucket(score: number) {
  if (score >= 80) return '80-100'
  if (score >= 60) return '60-79'
  if (score >= 40) return '40-59'
  return '0-39'
}

export default function DashboardPage() {
  const [races, setRaces] = useState<LocalRace[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/simple/races')
      .then(r => r.json())
      .then(d => setRaces(d.races ?? []))
      .finally(() => setLoading(false))
  }, [])

  const withResult = races.filter(r => r.result && r.analysis)
  const totalRaces = withResult.length
  const hitCount = withResult.filter(r => r.result!.isHit).length
  const totalStake = withResult.reduce((s, r) => s + r.result!.stake, 0)
  const totalPayout = withResult.reduce((s, r) => s + r.result!.payout, 0)
  const totalProfit = totalPayout - totalStake
  const hitRate = totalRaces > 0 ? Math.round((hitCount / totalRaces) * 100) : 0
  const roi = totalStake > 0 ? Math.round((totalPayout / totalStake) * 100) : 0

  // AIスコア別集計（本命馬のスコアで分類）
  const byScore: Record<string, { hits: number; total: number; stake: number; payout: number }> = {}
  for (const race of withResult) {
    const honmei = race.analysis!.honmei[0]
    const ha = race.analysis!.horses.find(h => h.horseName === honmei)
    const b = bucket(ha?.aiScore ?? 0)
    if (!byScore[b]) byScore[b] = { hits: 0, total: 0, stake: 0, payout: 0 }
    byScore[b].total++
    if (race.result!.isHit) byScore[b].hits++
    byScore[b].stake += race.result!.stake
    byScore[b].payout += race.result!.payout
  }

  const scoreData = ['80-100', '60-79', '40-59', '0-39'].map(b => ({
    name: `スコア${b}`,
    的中率: byScore[b] ? Math.round((byScore[b].hits / byScore[b].total) * 100) : 0,
    回収率: byScore[b] && byScore[b].stake > 0 ? Math.round((byScore[b].payout / byScore[b].stake) * 100) : 0,
    件数: byScore[b]?.total ?? 0,
  }))

  // 決定別集計（KEEP/HOLD/ELIMINATE × 的中率 は馬単体追跡が難しいので省略、代わりに見送りレースを除外）
  const byVenue: Record<string, { hits: number; total: number; profit: number }> = {}
  for (const race of withResult) {
    const v = race.venue
    if (!byVenue[v]) byVenue[v] = { hits: 0, total: 0, profit: 0 }
    byVenue[v].total++
    if (race.result!.isHit) byVenue[v].hits++
    byVenue[v].profit += race.result!.profit
  }
  const venueData = Object.entries(byVenue).map(([name, v]) => ({
    name,
    的中率: Math.round((v.hits / v.total) * 100),
    収支: v.profit,
    件数: v.total,
  }))

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">成績ダッシュボード</h1>
          <p className="text-white/40 text-sm mt-1">結果登録済みレースの集計</p>
        </div>
        <Link href="/simple" className="text-white/40 hover:text-white/70 transition text-sm">
          ← 一覧へ
        </Link>
      </div>

      {loading ? (
        <div className="text-center text-white/40 py-16">読み込み中...</div>
      ) : totalRaces === 0 ? (
        <div className="text-center py-16">
          <p className="text-white/40 mb-4">結果登録済みレースがまだありません</p>
          <Link href="/simple" className="text-amber-400 hover:text-amber-300 text-sm">
            レース一覧へ →
          </Link>
        </div>
      ) : (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { label: '集計レース数', value: totalRaces, unit: '件', cls: 'text-white' },
              { label: '的中率', value: `${hitRate}%`, unit: `${hitCount}/${totalRaces}`, cls: 'text-emerald-400' },
              { label: '回収率', value: `${roi}%`, unit: totalStake > 0 ? `${totalPayout.toLocaleString()}/${totalStake.toLocaleString()}円` : '', cls: roi >= 100 ? 'text-emerald-400' : 'text-red-400' },
              { label: '累計収支', value: `${totalProfit >= 0 ? '+' : ''}${totalProfit.toLocaleString()}円`, unit: '', cls: totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400' },
            ].map(card => (
              <div key={card.label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${card.cls}`}>{card.value}</div>
                {card.unit && <div className="text-white/30 text-xs mt-0.5">{card.unit}</div>}
                <div className="text-white/40 text-xs mt-1">{card.label}</div>
              </div>
            ))}
          </div>

          {/* AIスコア別グラフ */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-4">AIスコア別 的中率・回収率</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={scoreData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                />
                <Bar dataKey="的中率" fill="#34d399" radius={[4, 4, 0, 0]} />
                <Bar dataKey="回収率" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* AIスコア別テーブル */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
            <h2 className="text-white font-semibold mb-3">AIスコア別集計（本命馬スコア基準）</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-xs border-b border-white/10">
                  <th className="text-left py-2">スコア帯</th>
                  <th className="text-right py-2">件数</th>
                  <th className="text-right py-2">的中率</th>
                  <th className="text-right py-2">回収率</th>
                  <th className="text-right py-2">収支</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {['80-100', '60-79', '40-59', '0-39'].map(b => {
                  const d = byScore[b]
                  if (!d) return null
                  const r = Math.round((d.payout / d.stake) * 100)
                  const p = d.payout - d.stake
                  return (
                    <tr key={b}>
                      <td className="py-2 text-white">スコア{b}</td>
                      <td className="py-2 text-right text-white/60">{d.total}件</td>
                      <td className="py-2 text-right text-emerald-400">{Math.round((d.hits / d.total) * 100)}%</td>
                      <td className={`py-2 text-right font-medium ${r >= 100 ? 'text-emerald-400' : 'text-red-400'}`}>{r}%</td>
                      <td className={`py-2 text-right font-medium ${p >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {p >= 0 ? '+' : ''}{p.toLocaleString()}円
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 開催場別 */}
          {venueData.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h2 className="text-white font-semibold mb-3">開催場別集計</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs border-b border-white/10">
                    <th className="text-left py-2">開催場</th>
                    <th className="text-right py-2">件数</th>
                    <th className="text-right py-2">的中率</th>
                    <th className="text-right py-2">収支</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {venueData.map(v => (
                    <tr key={v.name}>
                      <td className="py-2 text-white">{v.name}</td>
                      <td className="py-2 text-right text-white/60">{v.件数}件</td>
                      <td className="py-2 text-right text-emerald-400">{v.的中率}%</td>
                      <td className={`py-2 text-right font-medium ${v.収支 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {v.収支 >= 0 ? '+' : ''}{v.収支.toLocaleString()}円
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
