'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface LocalRace {
  id: string
  raceDate: string
  venue: string
  raceNumber: number
  raceName: string
  surface: string
  distance: number
  horses: { horseName: string }[]
  analysis?: { overallComment: string; honmei: string[]; analyzedAt: string }
  result?: { isHit: boolean; profit: number }
  createdAt: string
}

export default function SimplePage() {
  const [races, setRaces] = useState<LocalRace[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/simple/races')
      .then(r => r.json())
      .then(d => setRaces(d.races ?? []))
      .finally(() => setLoading(false))
  }, [])

  const withResult = races.filter(r => r.result)
  const hits = withResult.filter(r => r.result!.isHit).length
  const totalProfit = withResult.reduce((s, r) => s + (r.result?.profit ?? 0), 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">シンプルAI予想</h1>
          <p className="text-white/50 text-sm mt-1">n8n・Prisma不要 / JSONファイル保存</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/simple/dashboard"
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 transition"
          >
            ダッシュボード
          </Link>
          <Link
            href="/simple/new"
            className="px-4 py-2 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition"
          >
            + 新規レース登録
          </Link>
        </div>
      </div>

      {/* サマリー */}
      {withResult.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{races.length}</div>
            <div className="text-white/50 text-xs mt-1">登録レース数</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">
              {withResult.length > 0 ? Math.round((hits / withResult.length) * 100) : 0}%
            </div>
            <div className="text-white/50 text-xs mt-1">的中率 ({hits}/{withResult.length})</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()}円
            </div>
            <div className="text-white/50 text-xs mt-1">累計収支</div>
          </div>
        </div>
      )}

      {/* レース一覧 */}
      {loading ? (
        <div className="text-center text-white/40 py-16">読み込み中...</div>
      ) : races.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-white/40 mb-4">まだレースが登録されていません</p>
          <Link
            href="/simple/new"
            className="px-6 py-3 bg-amber-500 text-black font-bold rounded-lg hover:bg-amber-400 transition"
          >
            最初のレースを登録する
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {races.map(race => {
            const status = race.result
              ? race.result.isHit
                ? { label: '的中', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
                : { label: '不的中', cls: 'bg-red-500/20 text-red-400 border-red-500/30' }
              : race.analysis
              ? { label: '分析済', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
              : { label: '未分析', cls: 'bg-white/10 text-white/50 border-white/20' }

            return (
              <Link
                key={race.id}
                href={`/simple/${race.id}`}
                className="block bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/8 hover:border-amber-500/30 transition group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${status.cls}`}
                    >
                      {status.label}
                    </span>
                    <div>
                      <span className="text-white font-medium">
                        {race.raceDate} {race.venue} {race.raceNumber}R
                      </span>
                      {race.raceName && (
                        <span className="text-white/50 text-sm ml-2">{race.raceName}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-white/40">
                      {race.surface}{race.distance}m / {race.horses.length}頭
                    </span>
                    {race.analysis?.honmei.length ? (
                      <span className="text-amber-400 text-xs">
                        本命: {race.analysis.honmei.slice(0, 2).join('・')}
                      </span>
                    ) : null}
                    {race.result && (
                      <span className={race.result.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {race.result.profit >= 0 ? '+' : ''}{race.result.profit.toLocaleString()}円
                      </span>
                    )}
                    <span className="text-white/20 group-hover:text-amber-400 transition">→</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
