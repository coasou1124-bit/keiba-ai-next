import { Surface, GateBias, GateTendencyResult } from '@/types'

// 距離カテゴリ（courseProfiles への依存を避けてローカル定義）
function getDistCat(distance: number) {
  if (distance <= 1400) return 'スプリント'
  if (distance <= 1800) return 'マイル'
  if (distance <= 2400) return '中距離'
  return '長距離'
}

interface GateTendency {
  bias: GateBias
  note: string
}

// キー優先度: 'venue-surface-distCat' > 'venue-surface' > default
const GATE_TENDENCY: Record<string, GateTendency> = {
  // 東京
  '東京-芝-スプリント': { bias: '内有利',  note: '東京芝スプリントは短距離で先行有利。内枠の逃げ・先行馬が有利なスタートポジションを取りやすい。' },
  '東京-芝-マイル':     { bias: 'フラット', note: '東京芝マイルは大箱・長直線でゲートバイアスが少ない。外枠の差し馬も十分に届くため枠番の影響は小さい。' },
  '東京-芝-中距離':     { bias: 'フラット', note: '東京芝中距離は長直線で末脚勝負になりやすく外枠不利が出にくい。差し・追込が外枠からも台頭できる。' },
  '東京-芝-長距離':     { bias: '内有利',  note: '東京芝長距離はスタート地点から最初のコーナーまでの距離が長く、先行争いで内枠が好位を確保しやすい。' },
  '東京-ダート':        { bias: '内有利',  note: '東京ダートは先行有利で内枠が好位を確保しやすい。内枠先行馬を中心に狙いたい。' },

  // 中山
  '中山-芝':    { bias: '内有利', note: '中山芝は小回り・急坂で内枠先行が圧倒的有利。外枠の差し馬にはよほどの展開待ちが必要。' },
  '中山-ダート': { bias: '内有利', note: '中山ダートも内枠先行が強い典型的な小回りコース。外枠の差し馬は厳しい。' },

  // 京都
  '京都-芝':    { bias: 'フラット', note: '京都芝外回りは長い直線で差し馬が台頭しやすく、ゲートバイアスは比較的小さい。' },
  '京都-ダート': { bias: '内有利',  note: '京都ダートは先行内枠が有利。' },

  // 阪神
  '阪神-芝-スプリント': { bias: '内有利',  note: '阪神芝スプリントは内回り使用で先行内枠が有利。' },
  '阪神-芝':            { bias: 'フラット', note: '阪神芝外回りは長直線で外枠差し馬も十分届く。急坂があるがゲートバイアスは少ない。' },
  '阪神-ダート':        { bias: '内有利',  note: '阪神ダートは先行内枠が圧倒的有利。逃げ馬のワンマンショーも多い。' },

  // 中京
  '中京-芝-スプリント': { bias: '内有利',  note: '中京芝スプリントは先行有利で内枠が好位を確保しやすい。' },
  '中京-芝':            { bias: 'フラット', note: '中京芝は412m長直線・平坦でゲートバイアスが少ない。差し馬も外から届く。' },
  '中京-ダート':        { bias: '内有利',  note: '中京ダートは先行内枠が有利。ペースが速くなりやすい分、内枠先行が逃げ切りやすい。' },

  // 新潟
  '新潟-芝':    { bias: '外有利', note: '新潟芝外回りはJRA最長658m直線・平坦で差し・追込が外から届きやすい。外枠が有利な数少ないコース。' },
  '新潟-ダート': { bias: '内有利', note: '新潟ダートは内枠先行が有利。芝外回りとは逆のバイアス。' },

  // 福島
  '福島-芝':    { bias: '内有利', note: '福島芝は292m直線の小回り・平坦。内枠先行馬が圧倒的有利でゲートバイアスが強い。' },
  '福島-ダート': { bias: '内有利', note: '福島ダートも内枠先行有利の小回りコース。' },

  // 小倉
  '小倉-芝':    { bias: '内有利', note: '小倉芝は293m直線の小回り。内枠先行が強くコーナーでの内側ポジションが決定的に重要。' },
  '小倉-ダート': { bias: '内有利', note: '小倉ダートも典型的な内枠先行有利。' },

  // 札幌
  '札幌-芝':    { bias: '内有利', note: '札幌芝は洋芝小回り。パワー型の内枠先行馬が消耗戦を制しやすい。' },
  '札幌-ダート': { bias: '内有利', note: '札幌ダートも内枠先行有利。洋芝の影響でパワーが問われる。' },

  // 函館
  '函館-芝':    { bias: '内有利', note: '函館芝はJRA最短直線262mの極小回り・洋芝。内枠先行が圧倒的有利で最強のゲートバイアス。' },
  '函館-ダート': { bias: '内有利', note: '函館ダートも逃げ・先行の内枠が最有利。' },
}

function getGateTendency(venue: string, surface: Surface, distance: number): GateTendency {
  const distCat = getDistCat(distance)
  return (
    GATE_TENDENCY[`${venue}-${surface}-${distCat}`] ??
    GATE_TENDENCY[`${venue}-${surface}`] ??
    { bias: 'フラット', note: 'このコースのゲートデータは標準値を適用。' }
  )
}

/**
 * 枠番の EV ボーナスを計算する。
 * pos = (gate - 1) / (maxGate - 1) として線形スケール。
 * 内有利: gate1 +6 ～ gateN -6
 * 外有利: gate1 -4 ～ gateN +6
 */
export function calcGateEvBonus(gate: number, bias: GateBias, maxGate: number): number {
  if (bias === 'フラット') return 0
  const pos = maxGate > 1 ? (gate - 1) / (maxGate - 1) : 0
  if (bias === '内有利') return Math.round(6 - pos * 12)
  return Math.round(-4 + pos * 10)
}

export function buildGateTendencyResult(
  venue: string,
  surface: Surface,
  distance: number,
  horses: { gate: number }[]
): GateTendencyResult {
  const { bias, note } = getGateTendency(venue, surface, distance)
  const maxGate = Math.max(...horses.map(h => h.gate), 1)

  const bonusTable: Record<number, number> = {}
  for (let g = 1; g <= maxGate; g++) {
    bonusTable[g] = calcGateEvBonus(g, bias, maxGate)
  }

  return {
    bias,
    note,
    maxGate,
    favoredGates: Object.entries(bonusTable).filter(([, v]) => v > 0).map(([k]) => Number(k)),
    penalizedGates: Object.entries(bonusTable).filter(([, v]) => v < 0).map(([k]) => Number(k)),
    bonusTable,
  }
}
