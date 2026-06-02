'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface HorseRow {
  horseNumber: number
  horseName: string
  popularity: number
  winOdds: number
  jockeyName: string
  runningStyle: string
}

const RUNNING_STYLES = ['', '逃げ', '先行', '差し', '追込']
const SURFACES = ['芝', 'ダート']
const CONDITIONS = ['良', '稍重', '重', '不良']

const blankHorse = (num: number): HorseRow => ({
  horseNumber: num,
  horseName: '',
  popularity: num,
  winOdds: 0,
  jockeyName: '',
  runningStyle: '',
})

export default function NewRacePage() {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  const [raceInfo, setRaceInfo] = useState({
    raceDate: today,
    venue: '東京',
    raceNumber: 1,
    raceName: '',
    distance: 1600,
    surface: '芝',
    trackCondition: '良',
  })

  const [horses, setHorses] = useState<HorseRow[]>([
    blankHorse(1), blankHorse(2), blankHorse(3), blankHorse(4), blankHorse(5),
  ])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function addHorse() {
    setHorses(prev => [...prev, blankHorse(prev.length + 1)])
  }

  function removeHorse(idx: number) {
    setHorses(prev => prev.filter((_, i) => i !== idx))
  }

  function updateHorse(idx: number, field: keyof HorseRow, value: string | number) {
    setHorses(prev => prev.map((h, i) => (i === idx ? { ...h, [field]: value } : h)))
  }

  async function handleSubmit() {
    const validHorses = horses.filter(h => h.horseName.trim())
    if (!raceInfo.raceDate || !raceInfo.venue || !raceInfo.raceNumber) {
      setError('日付・開催場・レース番号は必須です')
      return
    }
    if (validHorses.length < 2) {
      setError('馬名を2頭以上入力してください')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/simple/races', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...raceInfo, horses: validHorses }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/simple/${data.race.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '登録に失敗しました')
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/simple" className="text-white/40 hover:text-white/70 transition text-sm">
          ← 一覧へ
        </Link>
        <h1 className="text-2xl font-bold text-white">新規レース登録</h1>
      </div>

      {/* レース情報 */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
        <h2 className="text-white font-semibold mb-4">レース情報</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-white/50 text-xs mb-1 block">開催日</label>
            <input
              type="date"
              value={raceInfo.raceDate}
              onChange={e => setRaceInfo(p => ({ ...p, raceDate: e.target.value }))}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">開催場</label>
            <input
              type="text"
              placeholder="東京・中山・阪神…"
              value={raceInfo.venue}
              onChange={e => setRaceInfo(p => ({ ...p, venue: e.target.value }))}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">R番号</label>
            <input
              type="number"
              min={1}
              max={12}
              value={raceInfo.raceNumber}
              onChange={e => setRaceInfo(p => ({ ...p, raceNumber: Number(e.target.value) }))}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">レース名（任意）</label>
            <input
              type="text"
              placeholder="○○賞"
              value={raceInfo.raceName}
              onChange={e => setRaceInfo(p => ({ ...p, raceName: e.target.value }))}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">距離 (m)</label>
            <input
              type="number"
              step={100}
              min={800}
              max={3600}
              value={raceInfo.distance}
              onChange={e => setRaceInfo(p => ({ ...p, distance: Number(e.target.value) }))}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">コース</label>
            <select
              value={raceInfo.surface}
              onChange={e => setRaceInfo(p => ({ ...p, surface: e.target.value }))}
              className="w-full bg-slate-800 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
            >
              {SURFACES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">馬場</label>
            <select
              value={raceInfo.trackCondition}
              onChange={e => setRaceInfo(p => ({ ...p, trackCondition: e.target.value }))}
              className="w-full bg-slate-800 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
            >
              {CONDITIONS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 馬情報 */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">出走馬入力</h2>
          <span className="text-white/40 text-xs">馬名入力分のみ保存されます</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs border-b border-white/10">
                <th className="text-left py-2 w-10">馬番</th>
                <th className="text-left py-2 min-w-[120px]">馬名 *</th>
                <th className="text-left py-2 w-16">人気</th>
                <th className="text-left py-2 w-20">単勝倍率</th>
                <th className="text-left py-2 min-w-[100px]">騎手</th>
                <th className="text-left py-2 w-24">脚質</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {horses.map((h, i) => (
                <tr key={i}>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={1}
                      max={18}
                      value={h.horseNumber}
                      onChange={e => updateHorse(i, 'horseNumber', Number(e.target.value))}
                      className="w-12 bg-white/10 border border-white/10 rounded px-2 py-1 text-white text-center"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      placeholder="馬名"
                      value={h.horseName}
                      onChange={e => updateHorse(i, 'horseName', e.target.value)}
                      className="w-full bg-white/10 border border-white/10 rounded px-2 py-1 text-white"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={1}
                      max={18}
                      value={h.popularity}
                      onChange={e => updateHorse(i, 'popularity', Number(e.target.value))}
                      className="w-14 bg-white/10 border border-white/10 rounded px-2 py-1 text-white text-center"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      value={h.winOdds}
                      onChange={e => updateHorse(i, 'winOdds', Number(e.target.value))}
                      className="w-20 bg-white/10 border border-white/10 rounded px-2 py-1 text-white"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      placeholder="騎手名"
                      value={h.jockeyName}
                      onChange={e => updateHorse(i, 'jockeyName', e.target.value)}
                      className="w-full bg-white/10 border border-white/10 rounded px-2 py-1 text-white"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      value={h.runningStyle}
                      onChange={e => updateHorse(i, 'runningStyle', e.target.value)}
                      className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-white"
                    >
                      {RUNNING_STYLES.map(s => (
                        <option key={s} value={s}>{s || '—'}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => removeHorse(i)}
                      className="text-white/20 hover:text-red-400 transition text-xs"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          onClick={addHorse}
          className="mt-3 text-sm text-amber-400 hover:text-amber-300 transition"
        >
          + 馬を追加
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Link href="/simple" className="px-6 py-3 rounded-lg bg-white/5 text-white/60 text-sm hover:bg-white/10 transition">
          キャンセル
        </Link>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-8 py-3 bg-amber-500 text-black font-bold rounded-lg hover:bg-amber-400 transition disabled:opacity-50"
        >
          {submitting ? '登録中...' : '登録してAI分析へ →'}
        </button>
      </div>
    </div>
  )
}
