'use client'

import { useState, useEffect, useCallback } from 'react'

type HttpMethod = 'GET' | 'POST' | 'PATCH'

interface QueryParam {
  name: string
  description: string
  required: boolean
}

interface Endpoint {
  method: HttpMethod
  path: string
  description: string
  queryParams?: QueryParam[]
  requestSample?: string
  responseSample: string
}

const METHOD_COLOR: Record<HttpMethod, string> = {
  GET: 'text-green-400 bg-green-400/10 border-green-400/30',
  POST: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  PATCH: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
}

// ─── 消去法AI 型定義 ───────────────────────────────────────────
type Decision = 'KEEP' | 'HOLD' | 'ELIMINATE'

interface EliminationHorse {
  id: string
  raceId: string
  horseId: string
  aiScore: number
  survivalScore: number
  decision: Decision
  eliminateReasons: string[] | null
  valueComment: string
  horse: { horseName: string; horseNumber: number; popularity: number; winOdds: number }
  race:  { raceDate: string; venue: string; raceNumber: number; raceName: string }
}

const DECISION_STYLE: Record<Decision, { badge: string; row: string; label: string }> = {
  KEEP:      { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', row: 'bg-emerald-500/5',  label: '● KEEP' },
  HOLD:      { badge: 'bg-amber-500/20  text-amber-300  border-amber-500/40',    row: 'bg-amber-500/5',   label: '● HOLD' },
  ELIMINATE: { badge: 'bg-red-500/20    text-red-300    border-red-500/40',       row: 'bg-red-500/5',     label: '● ELIMINATE' },
}

// ─── 既存定数 ───────────────────────────────────────────────────
const CSV_SAMPLE = `raceDate,racecourse,raceNumber,raceName,surface,distance,trackCondition,horseName,frameNumber,horseNumber,popularity,odds,runningStyle
2024-01-21,東京,1,サンプルレース,芝,1600,良,ホースA,1,1,1,3.5,先行
2024-01-21,東京,1,サンプルレース,芝,1600,良,ホースB,2,2,2,5.2,差し
2024-01-21,東京,1,サンプルレース,芝,1600,良,ホースC,3,3,3,8.0,逃げ`

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/n8n/races',
    description: 'AIスコア・買い目提案・コース特性を含む全レース一覧を取得します。',
    responseSample: JSON.stringify({
      races: [
        {
          id: 'csv-2024-01-21-東京-1',
          date: '2024-01-21',
          venue: '東京',
          raceNumber: 1,
          raceName: 'サンプルレース',
          distance: 1600,
          surface: '芝',
          trackCondition: '良',
          overallEvScore: 85,
          optimizedBets: [
            {
              role: '本命', betType: '単勝', horses: ['ホースA'],
              odds: 3.5, allocationPct: 50, evScore: 85, signal: 'buy',
              reason: 'ホースA（本命候補・1番人気・3.5倍）。AIスコア+85でトップ評価。',
            },
          ],
        },
      ],
    }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/n8n/picks',
    description: '買い目提案のみをコンパクトに返します。raceIdクエリで1レースに絞り込み可能。',
    queryParams: [
      { name: 'raceId', description: '特定レースのID（例: csv-2024-01-21-東京-1）', required: false },
    ],
    responseSample: JSON.stringify({
      picks: [
        {
          raceId: 'csv-2024-01-21-東京-1',
          raceName: 'サンプルレース',
          date: '2024-01-21',
          venue: '東京',
          distance: 1600,
          surface: '芝',
          overallEvScore: 85,
          optimizedBets: [
            { role: '本命', betType: '単勝', horses: ['ホースA'], odds: 3.5, allocationPct: 50, evScore: 85, signal: 'buy' },
            { role: '穴', betType: 'ワイド', horses: ['ホースA', 'ホースC'], odds: 4.2, allocationPct: 30, evScore: 40, signal: 'buy' },
            { role: '保険', betType: '複勝', horses: ['ホースB'], odds: 1.8, allocationPct: 20, evScore: 30, signal: 'buy' },
          ],
        },
      ],
    }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/n8n/bets',
    description: '馬券を記録します。races APIで取得した情報をそのまま渡せます。',
    requestSample: JSON.stringify({
      date: '2024-01-21',
      venue: '東京',
      raceNumber: 1,
      raceName: 'サンプルレース',
      betType: '単勝',
      horses: ['ホースA'],
      odds: 3.5,
      stake: 1000,
      aiScore: 85,
      evScore: 85,
      surface: '芝',
      trackCondition: '良',
      paceType: 'ミドル',
      marketLabel: '本命候補',
      runningStyle: '先行',
      popularity: 1,
      aiRank: 1,
      raceId: 'csv-2024-01-21-東京-1',
    }, null, 2),
    responseSample: JSON.stringify({
      bet: {
        id: 'clx1234abcd',
        date: '2024-01-21',
        venue: '東京',
        raceName: 'サンプルレース',
        betType: '単勝',
        stake: 1000,
        isHit: null,
      },
    }, null, 2),
  },
  {
    method: 'PATCH',
    path: '/api/n8n/bets/{id}',
    description: '馬券の結果（的中/外れ・払戻金）を入力します。{id}はPOST時に返ったIDを使用。',
    requestSample: JSON.stringify({
      status: 'win',
      payout: 3500,
      resultPosition: 1,
      memo: 'n8nから自動入力',
    }, null, 2),
    responseSample: JSON.stringify({
      bet: {
        id: 'clx1234abcd',
        isHit: true,
        payout: 3500,
        profit: 2500,
        resultPosition: 1,
        memo: 'n8nから自動入力',
      },
    }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/n8n/import',
    description: 'CSVデータを取り込みます。n8nのRead Binary Fileノードで読み込んだCSVをそのまま渡せます。',
    requestSample: JSON.stringify({ csv: CSV_SAMPLE }, null, 2),
    responseSample: JSON.stringify({
      success: true,
      message: '1レース・3頭を取り込みました',
      created: 1,
      updated: 0,
      races: 1,
      horses: 3,
      warnings: [],
    }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/n8n/recommended',
    description: 'EV・AIスコアでフィルタした推奨レース一覧を返します。Discord/LINE用通知メッセージ付き。',
    queryParams: [
      { name: 'minEv', description: '最低 overallEvScore（デフォルト: 20）', required: false },
      { name: 'minAiScore', description: '最低AIスコア・本命馬（デフォルト: 30）', required: false },
      { name: 'minBetEv', description: '最低馬券evScore、ROI>120の代理指標（デフォルト: 20）', required: false },
    ],
    responseSample: JSON.stringify({
      recommendedCount: 1,
      generatedAt: '2024-01-21T08:00:00.000Z',
      criteria: { minEv: 20, minAiScore: 30, minBetEv: 20 },
      races: [
        {
          raceId: 'csv-2024-01-21-東京-1',
          raceName: 'サンプルレース',
          date: '2024-01-21',
          venue: '東京',
          raceNumber: 1,
          distance: 1600,
          surface: '芝',
          overallEvScore: 85,
          honmei: { name: 'ホースA', popularity: 1, winOdds: 3.5, aiScore: 75, marketLabel: '本命候補', aiScoreBonus: 3, aiScoreBonusReason: '東京×芝実績' },
          taiko: { name: 'ホースB', popularity: 3, winOdds: 5.2, aiScore: 45, marketLabel: '妙味あり' },
          bets: [{ role: '本命', betType: '単勝', horses: ['ホースA'], odds: 3.5, allocationPct: 50, evScore: 85, signal: 'buy', reason: 'AIスコアトップ評価' }],
          discordMessage: '🏇 **【買い推奨】東京 第1レース**\n📋 サンプルレース（芝1600m）\n\n🥇 **本命**: ホースA（1番人気 3.5倍）AIスコア `+75` 本命候補\n...',
          lineMessage: '【推奨】東京1R サンプルレース(芝1600m)\n本命:ホースA(1人気 3.5倍)AI+75\n対抗:ホースB(3人気)AI+45\n推奨:単勝ホースA(EV+85)\nEV+85 AIスコアトップ評価',
        },
      ],
    }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/n8n/webhook',
    description: 'Schedule Trigger や Webhook から呼び出し、推奨レースと通知メッセージをまとめて返します。cron定期実行のエントリポイント。',
    requestSample: JSON.stringify({ minEv: 20, minAiScore: 30, minBetEv: 20 }, null, 2),
    responseSample: JSON.stringify({
      recommendedCount: 1,
      generatedAt: '2024-01-21T08:00:00.000Z',
      criteria: { minEv: 20, minAiScore: 30, minBetEv: 20 },
      races: [
        {
          raceId: 'csv-2024-01-21-東京-1',
          raceName: 'サンプルレース',
          venue: '東京',
          raceNumber: 1,
          overallEvScore: 85,
          discordMessage: '🏇 **【買い推奨】東京 第1レース**\n...',
          lineMessage: '【推奨】東京1R サンプルレース...',
        },
      ],
      triggeredAt: '2024-01-21T08:00:01.000Z',
      webhookSource: 'POST /api/n8n/webhook',
    }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/eliminations',
    description: '馬ごとの消去法AI判定（生存率・消し理由・妙味コメント）を保存します。n8n の OpenAI 分析後に呼び出してください。',
    requestSample: JSON.stringify({
      raceId: 'clx_race_id_here',
      horseId: 'clx_horse_id_here',
      aiScore: 75,
      survivalScore: 62,
      decision: 'KEEP',
      eliminateReasons: [],
      valueComment: '前走好内容、距離短縮で期待',
    }, null, 2),
    responseSample: JSON.stringify({
      elimination: {
        id: 'clx...',
        raceId: 'clx_race_id_here',
        horseId: 'clx_horse_id_here',
        aiScore: 75,
        survivalScore: 62,
        decision: 'KEEP',
        eliminateReasons: [],
        valueComment: '前走好内容、距離短縮で期待',
        createdAt: '2024-01-21T08:00:00.000Z',
      },
    }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/eliminations',
    description: '消去法AI判定結果を取得します。raceId クエリで1レースに絞り込み可能。',
    queryParams: [
      { name: 'raceId', description: 'レースID（省略時は最新100件）', required: false },
      { name: 'limit',  description: '最大件数（デフォルト: 100、最大: 500）', required: false },
    ],
    responseSample: JSON.stringify({
      eliminations: [
        {
          id: 'clx...',
          raceId: 'clx_race_id_here',
          horseId: 'clx_horse_id_here',
          aiScore: 75,
          survivalScore: 62,
          decision: 'KEEP',
          eliminateReasons: [],
          valueComment: '前走好内容',
          horse: { horseName: 'ホースA', horseNumber: 1, popularity: 1, winOdds: 3.5 },
          race:  { raceDate: '2024-01-21', venue: '東京', raceNumber: 1, raceName: 'サンプルレース' },
        },
        {
          id: 'clx...',
          raceId: 'clx_race_id_here',
          horseId: 'clx_horse_id_here2',
          aiScore: 35,
          survivalScore: 28,
          decision: 'ELIMINATE',
          eliminateReasons: ['近走大敗続き', 'コース経験なし'],
          valueComment: '',
          horse: { horseName: 'ホースB', horseNumber: 2, popularity: 5, winOdds: 12.0 },
          race:  { raceDate: '2024-01-21', venue: '東京', raceNumber: 1, raceName: 'サンプルレース' },
        },
      ],
      count: 2,
    }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/n8n/stats',
    description: '馬券の統計（回収率・的中率・収支・セグメント別分析）を取得します。',
    responseSample: JSON.stringify({
      totalBets: 50,
      totalWins: 20,
      winRate: 40,
      returnRate: 95,
      totalProfit: -250,
      totalAmount: 50000,
      totalPayout: 47500,
      byBetType: [
        { label: '単勝', count: 30, winCount: 14, winRate: 47, returnRate: 102 },
        { label: '複勝', count: 20, winCount: 6, winRate: 30, returnRate: 85 },
      ],
    }, null, 2),
  },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={copy}
      className="text-xs px-2 py-0.5 rounded border border-white/15 text-white/40 hover:text-white/70 hover:border-white/30 transition-colors"
    >
      {copied ? '✓ コピー済み' : 'コピー'}
    </button>
  )
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-white/40 text-xs">{label}</span>
        <CopyButton text={code} />
      </div>
      <pre className="bg-black/30 border border-white/10 rounded-lg p-3 text-xs text-green-300/80 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {code}
      </pre>
    </div>
  )
}

// ─── 消去法AI プレビューコンポーネント ────────────────────────
function EliminationPreview() {
  const [eliminations, setEliminations] = useState<EliminationHorse[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [raceIdFilter, setRaceIdFilter] = useState('')

  const load = useCallback(async (rid?: string) => {
    setLoading(true)
    setError('')
    try {
      const url = '/api/eliminations' + (rid ? `?raceId=${encodeURIComponent(rid)}` : '?limit=50')
      const res = await fetch(url)
      if (!res.ok) throw new Error('fetch error')
      const data = await res.json()
      setEliminations(data.eliminations ?? [])
    } catch {
      setError('データ取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // raceId ごとにグループ化
  const grouped = eliminations.reduce<Record<string, EliminationHorse[]>>((acc, e) => {
    const key = e.raceId
    acc[key] = acc[key] ?? []
    acc[key].push(e)
    return acc
  }, {})

  return (
    <div className="mt-10">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xl">🔎</span>
        <h2 className="text-amber-400 font-bold text-lg">消去法AI 結果プレビュー</h2>
      </div>
      <p className="text-white/40 text-sm mb-4">
        n8n から保存された馬ごとの消去法AI判定を確認できます。
      </p>

      {/* raceId フィルタ */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="raceId で絞り込み（空欄=最新50件）"
          value={raceIdFilter}
          onChange={e => setRaceIdFilter(e.target.value)}
          className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-amber-400/50"
        />
        <button
          onClick={() => load(raceIdFilter || undefined)}
          className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs hover:bg-amber-500/30 transition-colors"
        >
          検索
        </button>
      </div>

      {loading && <p className="text-white/30 text-sm">読み込み中…</p>}
      {error   && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && eliminations.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-white/30 text-sm">
          まだデータがありません。n8n から <code className="text-white/50">POST /api/eliminations</code> を呼び出してください。
        </div>
      )}

      {!loading && !error && Object.entries(grouped).map(([raceId, horses]) => {
        const r = horses[0].race
        const keepCount     = horses.filter(h => h.decision === 'KEEP').length
        const eliminateCount = horses.filter(h => h.decision === 'ELIMINATE').length
        return (
          <div key={raceId} className="mb-4 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {/* レースヘッダー */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-white/80 text-sm font-semibold">
                  {r.venue} 第{r.raceNumber}レース
                </span>
                <span className="text-white/40 text-xs">{r.raceName}</span>
                <span className="text-white/30 text-xs">{r.raceDate}</span>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
                  KEEP {keepCount}
                </span>
                <span className="px-2 py-0.5 rounded border border-red-500/40 text-red-300 bg-red-500/10">
                  消 {eliminateCount}
                </span>
              </div>
            </div>

            {/* 馬一覧 */}
            <div className="divide-y divide-white/5">
              {horses.map(h => {
                const style = DECISION_STYLE[h.decision as Decision] ?? DECISION_STYLE.HOLD
                const reasons = Array.isArray(h.eliminateReasons) ? h.eliminateReasons : []
                return (
                  <div key={h.id} className={`px-4 py-3 ${style.row}`}>
                    <div className="flex items-start gap-3 flex-wrap">
                      {/* 馬番・馬名 */}
                      <span className="text-white/40 text-xs w-5 shrink-0 pt-0.5">{h.horse.horseNumber}</span>
                      <span className="text-white/80 text-sm font-medium min-w-[100px]">{h.horse.horseName}</span>

                      {/* バッジ */}
                      <span className={`text-xs font-bold border px-2 py-0.5 rounded shrink-0 ${style.badge}`}>
                        {style.label}
                      </span>

                      {/* スコア */}
                      <span className="text-white/50 text-xs shrink-0">
                        生存率 <span className="text-white/80 font-mono">{h.survivalScore}</span>
                        <span className="mx-1 text-white/20">|</span>
                        AI <span className="text-white/80 font-mono">{h.aiScore}</span>
                        <span className="mx-1 text-white/20">|</span>
                        {h.horse.popularity}人気 {h.horse.winOdds}倍
                      </span>
                    </div>

                    {/* 消し理由 */}
                    {reasons.length > 0 && (
                      <div className="mt-1.5 ml-8 flex flex-wrap gap-1">
                        {reasons.map((r, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-300/80">
                            {r}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 妙味コメント */}
                    {h.valueComment && (
                      <p className="mt-1 ml-8 text-xs text-emerald-300/70">{h.valueComment}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function N8nPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  // useEffect でマウント後に設定することで SSR/CSR の hydration mismatch を防ぐ
  const [baseUrl, setBaseUrl] = useState('')
  useEffect(() => { setBaseUrl(window.location.origin) }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">

        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">⚡</span>
            <h1 className="text-2xl font-bold text-white">n8n 連携 API</h1>
            <span className="text-xs px-2 py-0.5 rounded border border-violet-400/30 text-violet-400 bg-violet-400/10">
              REST API
            </span>
          </div>
          <p className="text-white/50 text-sm">
            n8nワークフローから競馬AIアプリのデータを読み書きできます。
            CSV取込・レース取得・買い目提案・結果保存・統計取得に対応。
          </p>
        </div>

        {/* 認証設定 */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 mb-8">
          <h2 className="text-amber-400 font-bold text-sm mb-3">認証設定</h2>
          <p className="text-white/60 text-xs mb-3">
            すべてのエンドポイントは <code className="text-amber-300 bg-black/30 px-1 rounded">N8N_API_KEY</code> による認証が必要です。
            n8nの HTTP Request ノードで以下のいずれかのヘッダーを設定してください。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-white/40 text-xs mb-1">方法A: Authorization ヘッダー</p>
              <code className="block bg-black/30 border border-white/10 rounded px-3 py-2 text-xs text-green-300">
                Authorization: Bearer {'<N8N_API_KEY>'}
              </code>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">方法B: x-api-key ヘッダー</p>
              <code className="block bg-black/30 border border-white/10 rounded px-3 py-2 text-xs text-green-300">
                x-api-key: {'<N8N_API_KEY>'}
              </code>
            </div>
          </div>
          <p className="text-white/30 text-xs mt-3">
            APIキーは .env の <code className="text-amber-300/70">N8N_API_KEY</code> で設定します。
            未設定の場合は認証スキップ（開発環境向け）。
          </p>
        </div>

        {/* ベースURL */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-8">
          <h2 className="text-white/70 font-semibold text-sm mb-2">ベースURL</h2>
          <div className="flex items-center justify-between">
            <code className="text-blue-300 text-sm">{baseUrl || '読み込み中…'}</code>
            {baseUrl && <CopyButton text={baseUrl} />}
          </div>
        </div>

        {/* エンドポイント一覧 */}
        <h2 className="text-amber-400 font-bold text-lg mb-4">エンドポイント</h2>
        <div className="space-y-3">
          {ENDPOINTS.map((ep, i) => (
            <div key={ep.path} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              {/* アコーディオンヘッダー */}
              <button
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/5 transition-colors"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span className={`text-xs font-bold border px-2 py-0.5 rounded font-mono shrink-0 ${METHOD_COLOR[ep.method]}`}>
                  {ep.method}
                </span>
                <code className="text-white/80 text-sm font-mono flex-1">{ep.path}</code>
                <span className="text-white/30 text-xs hidden md:block flex-1">{ep.description}</span>
                <span className="text-white/30 text-xs ml-2">{openIndex === i ? '▲' : '▼'}</span>
              </button>

              {/* アコーディオン本体 */}
              {openIndex === i && (
                <div className="border-t border-white/10 px-5 py-4">
                  <p className="text-white/50 text-sm mb-4">{ep.description}</p>

                  {/* クエリパラメータ */}
                  {ep.queryParams && ep.queryParams.length > 0 && (
                    <div className="mb-4">
                      <p className="text-white/40 text-xs font-semibold mb-2">クエリパラメータ</p>
                      <table className="text-xs w-full">
                        <thead>
                          <tr className="text-white/30">
                            <th className="text-left pb-1 pr-4">パラメータ</th>
                            <th className="text-left pb-1 pr-4">必須</th>
                            <th className="text-left pb-1">説明</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ep.queryParams.map(qp => (
                            <tr key={qp.name} className="text-white/60">
                              <td className="pr-4 py-0.5 font-mono text-blue-300">{qp.name}</td>
                              <td className="pr-4 py-0.5">{qp.required ? '必須' : '任意'}</td>
                              <td className="py-0.5">{qp.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* リクエストボディ */}
                  {ep.requestSample && (
                    <CodeBlock label="リクエストボディ（JSON）" code={ep.requestSample} />
                  )}

                  {/* レスポンス例 */}
                  <CodeBlock label="レスポンス例（200 OK）" code={ep.responseSample} />

                  {/* n8n HTTP Request 設定例 */}
                  <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3 mt-2">
                    <p className="text-violet-400 text-xs font-semibold mb-2">n8n HTTP Request ノード設定</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-white/60">
                      <div><span className="text-white/30">Method: </span><span className="text-white/80">{ep.method}</span></div>
                      <div className="flex items-center gap-1">
                        <span className="text-white/30">URL: </span>
                        <span className="text-white/80 font-mono truncate">{baseUrl}{ep.path.replace('{id}', '{{$json.bet.id}}')}</span>
                        <CopyButton text={`${baseUrl}${ep.path.replace('{id}', '{{$json.bet.id}}')} `} />
                      </div>
                      <div><span className="text-white/30">Authentication: </span><span className="text-white/80">Header Auth</span></div>
                      <div><span className="text-white/30">Header: </span><span className="text-white/80 font-mono">x-api-key: {'<N8N_API_KEY>'}</span></div>
                      {ep.requestSample && (
                        <div className="md:col-span-2">
                          <span className="text-white/30">Body Content Type: </span>
                          <span className="text-white/80">JSON</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ワークフロー例 */}
        <div className="mt-10 bg-white/5 border border-white/10 rounded-xl p-5">
          <h2 className="text-amber-400 font-bold text-base mb-3">ワークフロー例</h2>
          <div className="space-y-3">
            {[
              {
                title: '日次推奨通知',
                steps: ['Schedule Trigger (毎朝8時)', 'POST /api/n8n/webhook', 'IF (recommendedCount > 0)', 'Discord / LINE 通知 (discordMessage)'],
              },
              {
                title: 'CSV自動取込',
                steps: ['Schedule Trigger', 'Read CSV File (Google Drive / ローカル)', 'POST /api/n8n/import', 'Slack 通知（取込結果）'],
              },
              {
                title: '結果自動入力',
                steps: ['Webhook (レース結果通知)', 'HTTP Request → GET /api/n8n/races', 'Code Node (結果マッチング)', 'PATCH /api/n8n/bets/{id}'],
              },
              {
                title: '週次統計レポート',
                steps: ['Schedule Trigger (毎週月曜)', 'GET /api/n8n/stats', 'Google Sheets 書き込み', 'Email 送信'],
              },
            ].map(wf => (
              <div key={wf.title} className="flex items-start gap-3">
                <span className="text-amber-400/60 text-xs font-bold pt-0.5 shrink-0">{wf.title}</span>
                <div className="flex flex-wrap items-center gap-1">
                  {wf.steps.map((step, j) => (
                    <span key={j} className="flex items-center gap-1">
                      <span className="text-xs bg-white/10 border border-white/10 rounded px-2 py-0.5 text-white/60">{step}</span>
                      {j < wf.steps.length - 1 && <span className="text-white/20 text-xs">→</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 消去法AI 結果プレビュー */}
        <EliminationPreview />

        {/* n8n 設定ガイド */}
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xl">📖</span>
            <h2 className="text-amber-400 font-bold text-lg">n8n 設定ガイド</h2>
            <span className="text-xs px-2 py-0.5 rounded border border-emerald-400/30 text-emerald-400 bg-emerald-400/10">
              実運用テスト
            </span>
          </div>
          <p className="text-white/40 text-sm mb-6">
            毎朝 cron で EV &gt; 20 の推奨レースを取得し、Discord へ通知するワークフローの構築手順。
          </p>

          {/* フロー概要 */}
          <div className="flex items-center gap-4 flex-wrap p-4 bg-slate-800/50 border border-white/10 rounded-xl mb-6 overflow-x-auto">
            {[
              { icon: '⏰', label: 'Schedule Trigger', sub: '毎朝 8:00 (cron)' },
              { icon: '🌐', label: 'HTTP Request', sub: 'POST /api/n8n/webhook' },
              { icon: '🔀', label: 'IF ノード', sub: 'recommendedCount > 0' },
              { icon: '💬', label: 'Discord 通知', sub: 'discordMessage を送信' },
            ].map((node, i, arr) => (
              <span key={i} className="flex items-center gap-4">
                <span className="flex flex-col items-center gap-1 min-w-[90px]">
                  <span className="text-2xl">{node.icon}</span>
                  <span className="text-white/80 text-xs font-semibold text-center leading-tight">{node.label}</span>
                  <span className="text-white/30 text-xs text-center">{node.sub}</span>
                </span>
                {i < arr.length - 1 && <span className="text-white/20 text-xl">→</span>}
              </span>
            ))}
          </div>

          <div className="space-y-4">

            {/* Step 1: Schedule Trigger */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded">STEP 1</span>
                <span className="text-white/80 text-sm font-semibold">Schedule Trigger — Cron 設定</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-black/20 border border-white/10 rounded-lg p-3">
                  <p className="text-white/30 mb-2 font-semibold">Cron 式（月〜土 8:00）</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between"><span className="text-white/40">Trigger Rule</span><code className="text-green-300">Cron</code></div>
                    <div className="flex justify-between"><span className="text-white/40">Expression</span><code className="text-green-300">0 8 * * 1-6</code></div>
                  </div>
                </div>
                <div className="bg-black/20 border border-white/10 rounded-lg p-3">
                  <p className="text-white/30 mb-2 font-semibold">GUI 設定（毎日）</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between"><span className="text-white/40">Mode</span><code className="text-green-300">Every Day</code></div>
                    <div className="flex justify-between"><span className="text-white/40">Hour</span><code className="text-green-300">8</code></div>
                    <div className="flex justify-between"><span className="text-white/40">Minute</span><code className="text-green-300">0</code></div>
                  </div>
                </div>
              </div>
              <p className="text-white/30 text-xs mt-3">
                ※ n8n の Timezone を <code className="text-amber-300/70">Asia/Tokyo</code> に設定してください（Settings → n8n settings → Timezone）。
              </p>
            </div>

            {/* Step 2: HTTP Request */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded">STEP 2</span>
                <span className="text-white/80 text-sm font-semibold">HTTP Request — POST /api/n8n/webhook</span>
              </div>
              <p className="text-white/40 text-xs mb-3">推奨レース一覧と Discord/LINE 用メッセージを一括取得。EV フィルタもここで指定します。</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-white/30 text-xs font-semibold mb-2">ノード設定</p>
                  <div className="bg-black/20 border border-white/10 rounded-lg p-3 text-xs space-y-1.5">
                    <div className="flex justify-between"><span className="text-white/40">Method</span><code className="text-blue-300">POST</code></div>
                    <div className="break-all"><span className="text-white/40">URL </span><code className="text-blue-300">{baseUrl || 'https://your-app.vercel.app'}/api/n8n/webhook</code></div>
                    <div className="flex justify-between"><span className="text-white/40">Authentication</span><span className="text-white/70">Header Auth</span></div>
                    <div className="flex justify-between"><span className="text-white/40">Header Name</span><code className="text-green-300">x-api-key</code></div>
                    <div className="flex justify-between"><span className="text-white/40">Header Value</span><code className="text-green-300">{'<N8N_API_KEY>'}</code></div>
                    <div className="flex justify-between"><span className="text-white/40">Body Type</span><span className="text-white/70">JSON</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-white/30 text-xs font-semibold mb-2">リクエストボディ（EV &gt; 20 フィルタ）</p>
                  <CodeBlock label="" code={JSON.stringify({ minEv: 20, minAiScore: 30, minBetEv: 20 }, null, 2)} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-white/30 text-xs font-semibold mb-2">レスポンス例</p>
                <CodeBlock label="" code={JSON.stringify({
                  recommendedCount: 2,
                  generatedAt: '2024-01-21T08:00:00.000Z',
                  criteria: { minEv: 20, minAiScore: 30, minBetEv: 20 },
                  races: [
                    {
                      raceId: 'csv-2024-01-21-東京-1',
                      venue: '東京',
                      raceNumber: 1,
                      overallEvScore: 85,
                      honmei: { name: 'ホースA', popularity: 1, winOdds: 3.5, aiScore: 75 },
                      discordMessage: '🏇 **【買い推奨】東京 第1レース**\n📋 サンプルレース（芝1600m）\n\n🥇 **本命**: ホースA（1番人気 3.5倍）AIスコア `+75`\n...',
                      lineMessage: '【推奨】東京1R サンプルレース(芝1600m)\n本命:ホースA(1人気 3.5倍)AI+75\n...',
                    },
                  ],
                  triggeredAt: '2024-01-21T08:00:01.000Z',
                  webhookSource: 'POST /api/n8n/webhook',
                }, null, 2)} />
              </div>
            </div>

            {/* Step 3: IF ノード */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded">STEP 3</span>
                <span className="text-white/80 text-sm font-semibold">IF ノード — 推奨レースがある場合のみ通知</span>
              </div>
              <p className="text-white/40 text-xs mb-3">推奨レースが 0 件の日は Discord 通知をスキップします。</p>
              <div className="bg-black/20 border border-white/10 rounded-lg p-3 text-xs space-y-1.5 max-w-sm">
                <div className="flex justify-between"><span className="text-white/40">Value 1</span><code className="text-purple-300">{'{{$json.recommendedCount}}'}</code></div>
                <div className="flex justify-between"><span className="text-white/40">Operation</span><code className="text-purple-300">Larger Than</code></div>
                <div className="flex justify-between"><span className="text-white/40">Value 2</span><code className="text-purple-300">0</code></div>
              </div>
              <p className="text-white/30 text-xs mt-2">
                true ブランチ → Discord 通知 ／ false ブランチ → NoOp（何もしない）
              </p>
            </div>

            {/* Step 4: Discord 通知 */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded">STEP 4</span>
                <span className="text-white/80 text-sm font-semibold">Discord 通知</span>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-white/40 text-xs font-semibold mb-2">方法 A: Discord ノードを使う（推奨 — 1件目）</p>
                  <div className="bg-black/20 border border-white/10 rounded-lg p-3 text-xs space-y-1.5">
                    <div className="flex justify-between"><span className="text-white/40">Node type</span><span className="text-white/70">Discord</span></div>
                    <div className="flex justify-between"><span className="text-white/40">Webhook URL</span><span className="text-white/70">Discord チャンネルの Webhook URL</span></div>
                    <div className="flex gap-2"><span className="text-white/40 shrink-0">Text</span><code className="text-indigo-300">{'{{$json.races[0].discordMessage}}'}</code></div>
                  </div>
                </div>
                <div>
                  <p className="text-white/40 text-xs font-semibold mb-2">方法 B: HTTP Request → Discord Webhook（手動）</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-black/20 border border-white/10 rounded-lg p-3 text-xs space-y-1.5">
                      <div className="flex justify-between"><span className="text-white/40">Method</span><code className="text-blue-300">POST</code></div>
                      <div><span className="text-white/40">URL </span><span className="text-white/60 text-xs">https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN</span></div>
                      <div className="flex justify-between"><span className="text-white/40">Body Type</span><span className="text-white/70">JSON</span></div>
                    </div>
                    <CodeBlock label="ボディ" code={JSON.stringify({ content: '{{$json.races[0].discordMessage}}' }, null, 2)} />
                  </div>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                  <p className="text-emerald-400 text-xs font-semibold mb-2">複数レース対応 — Loop Over Items</p>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {['Loop Over Items\n(races を展開)', 'Discord 通知\n(discordMessage)', 'Merge'].map((s, i, arr) => (
                      <span key={i} className="flex items-center gap-1.5">
                        <span className="bg-white/10 border border-white/10 rounded px-2 py-1 text-white/60 whitespace-pre-line text-center text-xs leading-tight">{s}</span>
                        {i < arr.length - 1 && <span className="text-white/20 text-sm">→</span>}
                      </span>
                    ))}
                  </div>
                  <p className="text-white/40 text-xs">
                    Loop Over Items の「Input field」: <code className="text-emerald-300">races</code>
                    ／ 各通知のメッセージ: <code className="text-emerald-300">{'{{$json.discordMessage}}'}</code>
                  </p>
                </div>
              </div>
            </div>

            {/* 参考: GET版 */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded">参考</span>
                <span className="text-white/80 text-sm font-semibold">GET /api/n8n/recommended — クエリパラメータ版</span>
              </div>
              <p className="text-white/50 text-xs mb-3">POST Webhook の代わりに GET でシンプルに取得したい場合はこちら。</p>
              <div className="bg-black/20 border border-white/10 rounded-lg p-3 text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-white/40">Method</span><code className="text-green-300">GET</code></div>
                <div className="break-all">
                  <span className="text-white/40">URL </span>
                  <code className="text-green-300">{baseUrl || 'https://your-app.vercel.app'}/api/n8n/recommended?minEv=20{'&'}minAiScore=30{'&'}minBetEv=20</code>
                </div>
                <div className="flex justify-between"><span className="text-white/40">Authentication</span><span className="text-white/70">Header Auth (x-api-key)</span></div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
