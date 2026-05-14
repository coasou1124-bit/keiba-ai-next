'use client'

import { useEffect, useState } from 'react'

// ---- 型定義 ----
type ResultStatus = 'pending' | 'win' | 'lose'
type FilterType = 'all' | 'pending' | 'win' | 'lose'

interface BetRecord {
  id: string
  date: string
  venue: string
  raceNumber: number
  raceName: string
  betType: string
  horses: string[]
  odds: number
  amount: number
  aiScore: number
  evScore: number
  isValueBet?: boolean
  marketLabel?: string
  aiComment?: string
  runningStyle?: string
  aiRank?: number
  popularity?: number
  status: ResultStatus
  payout?: number
  resultPosition?: number
  memo?: string
}

interface EditState {
  status: ResultStatus
  stake: string
  payout: string
  resultPosition: string
  memo: string
  saving: boolean
  saved: boolean
  error: string | null
}

// ---- ステータスバッジ ----
function StatusBadge({ status }: { status: ResultStatus }) {
  if (status === 'win')
    return (
      <span className="text-xs font-bold text-green-400 bg-green-400/10 border border-green-400/30 px-2 py-0.5 rounded-full">
        的中
      </span>
    )
  if (status === 'lose')
    return (
      <span className="text-xs font-bold text-red-400 bg-red-400/10 border border-red-400/30 px-2 py-0.5 rounded-full">
        不的中
      </span>
    )
  return (
    <span className="text-xs font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-2 py-0.5 rounded-full">
      未入力
    </span>
  )
}

// ---- 市場ラベルバッジ ----
const LABEL_STYLE: Record<string, string> = {
  '妙味あり':  'text-teal-300 bg-teal-400/15 border-teal-400/40',
  '過小評価':  'text-green-300 bg-green-400/15 border-green-400/40',
  '危険人気馬': 'text-red-300 bg-red-400/15 border-red-400/40',
  '本命候補':  'text-amber-300 bg-amber-400/15 border-amber-400/40',
}

function MarketBadge({ label }: { label?: string }) {
  if (!label || label === '標準' || !LABEL_STYLE[label]) return null
  return (
    <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded ${LABEL_STYLE[label]}`}>
      {label}
    </span>
  )
}

// ---- 馬券カード ----
function BetCard({
  bet,
  onChange,
}: {
  bet: BetRecord
  onChange: (id: string, status: ResultStatus, payout: number | undefined) => void
}) {
  const [edit, setEdit] = useState<EditState>({
    status: bet.status,
    stake: String(bet.amount),
    payout: bet.payout !== undefined && bet.payout > 0 ? String(bet.payout) : '',
    resultPosition: bet.resultPosition !== undefined && bet.resultPosition > 0 ? String(bet.resultPosition) : '',
    memo: bet.memo ?? '',
    saving: false,
    saved: false,
    error: null,
  })

  const stakeNum = Number(edit.stake) || 0
  const profit =
    edit.status === 'win'
      ? (Number(edit.payout) || 0) - stakeNum
      : edit.status === 'lose'
      ? -stakeNum
      : null

  const returnRate =
    edit.status === 'win' && stakeNum > 0
      ? (((Number(edit.payout) || 0) / stakeNum) * 100).toFixed(0)
      : edit.status === 'lose'
      ? '0'
      : null

  function toggleStatus(s: ResultStatus) {
    setEdit((e) => ({
      ...e,
      status: e.status === s ? 'pending' : s,
      saved: false,
    }))
  }

  async function handleSave() {
    setEdit((e) => ({ ...e, saving: true, error: null, saved: false }))
    try {
      const body: Record<string, unknown> = {
        status: edit.status,
        stake: Number(edit.stake) || 0,
        resultPosition: Number(edit.resultPosition) || 0,
        memo: edit.memo,
      }
      if (edit.status === 'win') {
        body.payout = Number(edit.payout) || 0
      }
      const res = await fetch(`/api/bets/${bet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('保存に失敗しました')
      setEdit((e) => ({ ...e, saving: false, saved: true }))
      onChange(
        bet.id,
        edit.status,
        edit.status === 'win' ? Number(edit.payout) || 0 : undefined
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保存に失敗しました'
      setEdit((e) => ({ ...e, saving: false, error: message }))
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
      {/* ヘッダー行 */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h3 className="text-white font-bold text-sm leading-tight">{bet.raceName}</h3>
            {bet.isValueBet && (
              <span className="text-[10px] font-bold text-amber-300 bg-amber-400/15 border border-amber-400/30 px-1.5 py-0.5 rounded">
                買い
              </span>
            )}
            <MarketBadge label={bet.marketLabel} />
          </div>
          <p className="text-white/50 text-xs">
            {bet.date} / {bet.venue} / {bet.raceNumber}R
          </p>
        </div>
        <StatusBadge status={edit.status} />
      </div>

      {/* 馬券情報 */}
      <div className="flex flex-wrap gap-3 text-xs mb-4">
        <div className="flex items-center gap-1">
          <span className="text-white/40">馬券種</span>
          <span className="text-white/80 font-medium bg-white/10 px-2 py-0.5 rounded">{bet.betType}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-white/40">馬</span>
          <span className="text-white/80 font-medium">{bet.horses.join(' - ')}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-white/40">オッズ</span>
          <span className="text-amber-400 font-bold">{bet.odds.toFixed(1)}</span>
        </div>
        {bet.evScore !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-white/40">EV</span>
            <span className={`font-bold ${bet.evScore >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {bet.evScore >= 0 ? '+' : ''}{bet.evScore}
            </span>
          </div>
        )}
        {bet.aiScore > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-white/40">AIスコア</span>
            <span className={`font-bold ${bet.aiScore >= 50 ? 'text-green-400' : 'text-amber-400'}`}>
              {bet.aiScore}
            </span>
          </div>
        )}
        {bet.aiRank != null && bet.aiRank > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-white/40">AI予測</span>
            <span className="text-white/70 font-medium">{bet.aiRank}位</span>
          </div>
        )}
        {bet.popularity != null && bet.popularity > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-white/40">人気</span>
            <span className="text-white/70 font-medium">{bet.popularity}番人気</span>
          </div>
        )}
        {bet.runningStyle && (
          <div className="flex items-center gap-1">
            <span className="text-white/40">脚質</span>
            <span className="text-white/70 font-medium">{bet.runningStyle}</span>
          </div>
        )}
      </div>

      {/* 入力エリア */}
      <div className="space-y-2.5 mb-4">
        {/* 購入金額（編集可） */}
        <div className="flex items-center gap-2">
          <label className="text-white/50 text-xs w-16 flex-shrink-0">購入金額</label>
          <input
            type="number"
            min={0}
            step={100}
            value={edit.stake}
            onChange={(e) => setEdit((s) => ({ ...s, stake: e.target.value, saved: false }))}
            placeholder="購入金額"
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-400/50"
          />
          <span className="text-white/50 text-xs">円</span>
        </div>

        {/* 払戻金（的中時） */}
        {edit.status === 'win' && (
          <div className="flex items-center gap-2">
            <label className="text-white/50 text-xs w-16 flex-shrink-0">払戻金</label>
            <input
              type="number"
              min={0}
              step={10}
              value={edit.payout}
              onChange={(e) => setEdit((s) => ({ ...s, payout: e.target.value, saved: false }))}
              placeholder="払戻金額"
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-400/50"
            />
            <span className="text-white/50 text-xs">円</span>
          </div>
        )}

        {/* 着順 */}
        {edit.status !== 'pending' && (
          <div className="flex items-center gap-2">
            <label className="text-white/50 text-xs w-16 flex-shrink-0">着順</label>
            <input
              type="number"
              min={1}
              max={18}
              value={edit.resultPosition}
              onChange={(e) => setEdit((s) => ({ ...s, resultPosition: e.target.value, saved: false }))}
              placeholder="着順"
              className="w-20 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-400/50"
            />
            <span className="text-white/50 text-xs">着</span>
          </div>
        )}

        {/* メモ */}
        <div className="flex items-start gap-2">
          <label className="text-white/50 text-xs w-16 flex-shrink-0 pt-1.5">メモ</label>
          <textarea
            value={edit.memo}
            onChange={(e) => setEdit((s) => ({ ...s, memo: e.target.value, saved: false }))}
            placeholder="レースのメモを入力"
            rows={2}
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-400/50 resize-none"
          />
        </div>
      </div>

      {/* 的中/不的中 トグル */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => toggleStatus('win')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all duration-200 ${
            edit.status === 'win'
              ? 'bg-green-500/30 text-green-300 border-green-500/50'
              : 'bg-green-500/10 text-green-400/60 border-green-500/20 hover:bg-green-500/20'
          }`}
        >
          的中 ✓
        </button>
        <button
          onClick={() => toggleStatus('lose')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all duration-200 ${
            edit.status === 'lose'
              ? 'bg-red-500/30 text-red-300 border-red-500/50'
              : 'bg-red-500/10 text-red-400/60 border-red-500/20 hover:bg-red-500/20'
          }`}
        >
          不的中 ✗
        </button>
      </div>

      {/* 収支・回収率 */}
      {profit !== null && (
        <div className="flex gap-4 text-xs mb-3 bg-white/5 rounded-xl px-3 py-2">
          <div>
            <span className="text-white/40">収支</span>
            <span className={`ml-1 font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {profit >= 0 ? '+' : ''}{profit.toLocaleString()}円
            </span>
          </div>
          {returnRate !== null && (
            <div>
              <span className="text-white/40">回収率</span>
              <span className={`ml-1 font-bold ${Number(returnRate) >= 100 ? 'text-green-400' : 'text-red-400'}`}>
                {returnRate}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* 保存ボタン */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={edit.saving || edit.status === 'pending'}
          className="bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg px-4 py-2 text-sm font-bold hover:bg-amber-500/30 transition-colors disabled:opacity-40"
        >
          {edit.saving ? '保存中...' : '保存する'}
        </button>
        {edit.saved && <span className="text-green-400 text-xs font-medium">保存しました ✓</span>}
        {edit.error && <span className="text-red-400 text-xs">{edit.error}</span>}
      </div>
    </div>
  )
}

// ---- フィルタータブ ----
function FilterTab({
  active, label, count, onClick,
}: {
  active: boolean; label: string; count: number; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          : 'text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent'
      }`}
    >
      {label}
      <span className="ml-1.5 text-xs opacity-70">({count})</span>
    </button>
  )
}

// ---- メインページ ----
export default function ResultsPage() {
  const [bets, setBets] = useState<BetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')

  useEffect(() => {
    fetch('/api/bets')
      .then((r) => {
        if (!r.ok) throw new Error('馬券データの取得に失敗しました')
        return r.json()
      })
      .then((data: BetRecord[]) => {
        setBets(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'エラーが発生しました'
        setError(message)
        setLoading(false)
      })
  }, [])

  function handleChange(id: string, status: ResultStatus, payout: number | undefined) {
    setBets((prev) => prev.map((b) => (b.id === id ? { ...b, status, payout } : b)))
  }

  const counts = {
    all: bets.length,
    pending: bets.filter((b) => b.status === 'pending').length,
    win: bets.filter((b) => b.status === 'win').length,
    lose: bets.filter((b) => b.status === 'lose').length,
  }

  const filtered = filter === 'all' ? bets : bets.filter((b) => b.status === filter)

  const totalAmount = bets.filter((b) => b.status !== 'pending').reduce((s, b) => s + b.amount, 0)
  const totalPayout = bets.filter((b) => b.status === 'win').reduce((s, b) => s + (b.payout || 0), 0)
  const totalProfit = totalPayout - totalAmount
  const totalReturnRate = totalAmount > 0 ? ((totalPayout / totalAmount) * 100).toFixed(1) : null

  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 md:pb-8 pt-6">
      {/* ページタイトル */}
      <div className="mb-6">
        <h1 className="text-amber-400 font-bold text-2xl">結果入力</h1>
        <p className="text-white/50 text-sm mt-1">記録した馬券の的中・不的中を入力してください</p>
      </div>

      {/* 総計バナー */}
      {!loading && !error && bets.some((b) => b.status !== 'pending') && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm mb-6">
          <p className="text-white/40 text-xs mb-2">確定済み収支</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-white/50">投資額</span>
              <span className="ml-1 text-white font-bold">{totalAmount.toLocaleString()}円</span>
            </div>
            <div>
              <span className="text-white/50">払戻</span>
              <span className="ml-1 text-white font-bold">{totalPayout.toLocaleString()}円</span>
            </div>
            <div>
              <span className="text-white/50">収支</span>
              <span className={`ml-1 font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()}円
              </span>
            </div>
            {totalReturnRate && (
              <div>
                <span className="text-white/50">回収率</span>
                <span className={`ml-1 font-bold ${Number(totalReturnRate) >= 100 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalReturnRate}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* エラー */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* フィルタータブ */}
      {!loading && !error && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {(
            [
              { key: 'all', label: 'すべて' },
              { key: 'pending', label: '未入力' },
              { key: 'win', label: '的中' },
              { key: 'lose', label: '不的中' },
            ] as { key: FilterType; label: string }[]
          ).map((f) => (
            <FilterTab
              key={f.key}
              active={filter === f.key}
              label={f.label}
              count={counts[f.key]}
              onClick={() => setFilter(f.key)}
            />
          ))}
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/2 mb-3" />
              <div className="h-3 bg-white/10 rounded w-1/3 mb-4" />
              <div className="h-8 bg-white/10 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* 馬券リスト */}
      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
              <p className="text-white/40 text-base">馬券が記録されていません</p>
              <p className="text-white/30 text-sm mt-2">ホーム画面から馬券を記録してください</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((bet) => (
                <BetCard key={bet.id} bet={bet} onChange={handleChange} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
