'use client'

import { useState } from 'react'

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

export default function N8nPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001'

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
            <code className="text-blue-300 text-sm">{baseUrl}</code>
            <CopyButton text={baseUrl} />
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
                title: '日次買い目通知',
                steps: ['Schedule Trigger (毎朝8時)', 'GET /api/n8n/picks', 'Filter (signal = "buy")', 'Telegram / Slack 通知'],
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

      </div>
    </div>
  )
}
