'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Decision = 'KEEP' | 'HOLD' | 'ELIMINATE'

interface LocalHorse {
  horseNumber: number; horseName: string; popularity: number; winOdds: number
  jockeyName: string; runningStyle: string
}
interface HorseAnalysis {
  horseNumber: number; horseName: string; aiScore: number; survivalScore: number
  decision: Decision; reasons: string[]; valueComment: string
}
interface BetSuggestion { betType: string; horses: string[]; reason: string }
interface RaceAnalysis {
  horses: HorseAnalysis[]; honmei: string[]; anaume: string[]; kiken: string[]
  kaime: BetSuggestion[]; miokuri: boolean; overallComment: string; analyzedAt: string
}
interface RaceResult { isHit: boolean; stake: number; payout: number; profit: number; memo: string; recordedAt: string }
interface LocalRace {
  id: string; raceDate: string; venue: string; raceNumber: number; raceName: string
  distance: number; surface: string; trackCondition: string; horses: LocalHorse[]
  analysis?: RaceAnalysis; result?: RaceResult; createdAt: string
}

const D_STYLE: Record<Decision, { badge: string; row: string; label: string }> = {
  KEEP:      { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', row: 'bg-emerald-500/5',  label: '● KEEP 本命候補' },
  HOLD:      { badge: 'bg-amber-500/20  text-amber-300  border-amber-500/40',    row: 'bg-amber-500/5',   label: '● HOLD 様子見' },
  ELIMINATE: { badge: 'bg-red-500/20    text-red-300    border-red-500/40',       row: 'bg-red-500/5',     label: '● ELIMINATE 消し' },
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-white/60 w-8 text-right">{value}</span>
    </div>
  )
}

export default function RaceDetailPage({ params }: { params: { id: string } }) {
  const [race, setRace] = useState<LocalRace | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [resultForm, setResultForm] = useState({ isHit: false, stake: 1000, payout: 0, memo: '' })
  const [savingResult, setSavingResult] = useState(false)

  async function load() {
    const res = await fetch(`/api/simple/races/${params.id}`)
    const d = await res.json()
    if (d.race) setRace(d.race)
  }

  useEffect(() => { load() }, [params.id])

  async function runAnalysis() {
    setAnalyzing(true)
    setAnalyzeError('')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raceId: params.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRace(data.race)
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : '分析に失敗しました')
    } finally {
      setAnalyzing(false)
    }
  }

  async function saveResult() {
    setSavingResult(true)
    try {
      const res = await fetch(`/api/simple/races/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: {
            ...resultForm,
            profit: resultForm.payout - resultForm.stake,
            recordedAt: new Date().toISOString(),
          },
        }),
      })
      const d = await res.json()
      if (d.race) setRace(d.race)
    } finally {
      setSavingResult(false)
    }
  }

  if (!race) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center text-white/40">読み込み中...</div>
  )

  const analysis = race.analysis

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/simple" className="text-white/40 hover:text-white/70 transition text-sm">← 一覧</Link>
        <div>
          <h1 className="text-xl font-bold text-white">
            {race.raceDate} {race.venue} {race.raceNumber}R
            {race.raceName && <span className="text-white/60 text-base ml-2">{race.raceName}</span>}
          </h1>
          <p className="text-white/40 text-sm">
            {race.surface}{race.distance}m / 馬場:{race.trackCondition} / {race.horses.length}頭立て
          </p>
        </div>
      </div>

      {/* 出走馬テーブル */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold mb-3">出走馬</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs border-b border-white/10">
                <th className="text-left py-2 w-10">馬番</th>
                <th className="text-left py-2">馬名</th>
                <th className="text-left py-2 w-14">人気</th>
                <th className="text-left py-2 w-16">単勝</th>
                <th className="text-left py-2">騎手</th>
                <th className="text-left py-2 w-16">脚質</th>
                {analysis && <th className="text-left py-2 w-24">AI判定</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {race.horses.map(h => {
                const ha = analysis?.horses.find(x => x.horseNumber === h.horseNumber)
                return (
                  <tr key={h.horseNumber} className={ha ? D_STYLE[ha.decision].row : ''}>
                    <td className="py-2 text-white/60">{h.horseNumber}</td>
                    <td className="py-2 text-white font-medium">{h.horseName}</td>
                    <td className="py-2 text-white/60">{h.popularity}番人気</td>
                    <td className="py-2 text-amber-400">{h.winOdds}倍</td>
                    <td className="py-2 text-white/50">{h.jockeyName || '—'}</td>
                    <td className="py-2 text-white/50">{h.runningStyle || '—'}</td>
                    {analysis && ha && (
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${D_STYLE[ha.decision].badge}`}>
                          {ha.decision}
                        </span>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI 分析ボタン / 分析結果 */}
      {!analysis ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6 text-center">
          <p className="text-white/60 mb-4">
            AI分析を実行します。APIキーが未設定の場合はルールベース分析を行います。
          </p>
          {analyzeError && (
            <p className="text-red-400 text-sm mb-3">{analyzeError}</p>
          )}
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="px-8 py-3 bg-amber-500 text-black font-bold rounded-lg hover:bg-amber-400 transition disabled:opacity-50 disabled:cursor-wait"
          >
            {analyzing ? '分析中...' : 'AI分析を実行する'}
          </button>
        </div>
      ) : (
        <>
          {/* 見送り判定バナー */}
          {analysis.miokuri && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium">
              このレースは見送り推奨です
            </div>
          )}

          {/* 本命・穴馬・危険馬 */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: '本命候補', names: analysis.honmei, cls: 'border-emerald-500/30 bg-emerald-500/5', nameCls: 'text-emerald-400' },
              { label: '穴馬候補', names: analysis.anaume, cls: 'border-amber-500/30 bg-amber-500/5',   nameCls: 'text-amber-400'   },
              { label: '危険馬',   names: analysis.kiken,  cls: 'border-red-500/30 bg-red-500/5',       nameCls: 'text-red-400'     },
            ].map(({ label, names, cls, nameCls }) => (
              <div key={label} className={`border rounded-xl p-4 ${cls}`}>
                <div className="text-white/50 text-xs mb-2">{label}</div>
                {names.length ? (
                  names.map(n => <div key={n} className={`font-bold text-sm ${nameCls}`}>{n}</div>)
                ) : (
                  <div className="text-white/30 text-xs">なし</div>
                )}
              </div>
            ))}
          </div>

          {/* 各馬分析カード */}
          <div className="mb-6">
            <h2 className="text-white font-semibold mb-3">各馬評価</h2>
            <div className="space-y-2">
              {[...analysis.horses]
                .sort((a, b) => b.aiScore - a.aiScore)
                .map(h => (
                  <div key={h.horseName} className={`border border-white/10 rounded-xl p-4 ${D_STYLE[h.decision].row}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${D_STYLE[h.decision].badge}`}>
                          {h.decision}
                        </span>
                        <div className="min-w-0">
                          <span className="text-white font-semibold">
                            {h.horseNumber}. {h.horseName}
                          </span>
                          <p className="text-white/50 text-xs mt-0.5 truncate">{h.valueComment}</p>
                        </div>
                      </div>
                      <div className="shrink-0 w-40">
                        <div className="mb-1">
                          <div className="text-white/40 text-xs mb-0.5">AIスコア</div>
                          <ScoreBar value={h.aiScore} color="bg-blue-400" />
                        </div>
                        <div>
                          <div className="text-white/40 text-xs mb-0.5">生存スコア</div>
                          <ScoreBar value={h.survivalScore} color="bg-emerald-400" />
                        </div>
                      </div>
                    </div>
                    {h.reasons.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {h.reasons.map((r, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/50">
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* 買い目提案 */}
          {analysis.kaime.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 mb-6">
              <h2 className="text-amber-400 font-semibold mb-3">買い目候補</h2>
              <div className="space-y-2">
                {analysis.kaime.map((k, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-amber-400 font-bold px-2 py-0.5 bg-amber-500/10 rounded">
                      {k.betType}
                    </span>
                    <span className="text-white">{k.horses.join(' → ')}</span>
                    <span className="text-white/40 text-xs">{k.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 総評 */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
            <h2 className="text-white/60 text-sm mb-2">AI総評</h2>
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line">{analysis.overallComment}</p>
            <p className="text-white/30 text-xs mt-2">分析時刻: {new Date(analysis.analyzedAt).toLocaleString('ja-JP')}</p>
          </div>

          {/* 再分析ボタン */}
          <div className="flex justify-end mb-6">
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="px-4 py-2 text-sm text-white/40 hover:text-white/70 border border-white/10 rounded-lg hover:border-white/30 transition disabled:opacity-50"
            >
              {analyzing ? '分析中...' : '再分析する'}
            </button>
          </div>
        </>
      )}

      {/* 結果登録 */}
      {analysis && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          {race.result ? (
            <div>
              <h2 className="text-white font-semibold mb-3">登録済み結果</h2>
              <div className="flex items-center gap-6 text-sm">
                <span className={`font-bold px-3 py-1 rounded-full text-sm ${race.result.isHit ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {race.result.isHit ? '的中' : '不的中'}
                </span>
                <span className="text-white/60">掛金: {race.result.stake.toLocaleString()}円</span>
                <span className="text-white/60">払戻: {race.result.payout.toLocaleString()}円</span>
                <span className={race.result.profit >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                  {race.result.profit >= 0 ? '+' : ''}{race.result.profit.toLocaleString()}円
                </span>
              </div>
              {race.result.memo && <p className="text-white/40 text-sm mt-2">{race.result.memo}</p>}
            </div>
          ) : (
            <div>
              <h2 className="text-white font-semibold mb-4">結果を登録する</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="md:col-span-4 flex items-center gap-3">
                  <label className="text-white/60 text-sm">結果</label>
                  <button
                    onClick={() => setResultForm(p => ({ ...p, isHit: !p.isHit }))}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${
                      resultForm.isHit
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-red-500/20 text-red-400 border border-red-500/40'
                    }`}
                  >
                    {resultForm.isHit ? '的中' : '不的中'}
                  </button>
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1 block">掛金 (円)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={resultForm.stake}
                    onChange={e => setResultForm(p => ({ ...p, stake: Number(e.target.value) }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1 block">払戻金 (円)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={resultForm.payout}
                    onChange={e => setResultForm(p => ({ ...p, payout: Number(e.target.value) }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-white/50 text-xs mb-1 block">メモ</label>
                  <input
                    type="text"
                    placeholder="自由メモ"
                    value={resultForm.memo}
                    onChange={e => setResultForm(p => ({ ...p, memo: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-sm">
                  収支: {((resultForm.payout - resultForm.stake) >= 0 ? '+' : '')}{(resultForm.payout - resultForm.stake).toLocaleString()}円
                </span>
                <button
                  onClick={saveResult}
                  disabled={savingResult}
                  className="px-6 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-400 transition disabled:opacity-50 text-sm"
                >
                  {savingResult ? '保存中...' : '結果を保存'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
