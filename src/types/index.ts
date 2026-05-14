export type Surface = '芝' | 'ダート'
export type RunningStyle = '逃げ' | '先行' | '差し' | '追込'
export type BetType = '単勝' | '複勝' | 'ワイド' | '馬連'
export type BetRole = '本命' | '穴' | '保険'
export type VenueScale = '大箱' | '小回り'
export type DistanceCategory = 'スプリント' | 'マイル' | '中距離' | '長距離'
export type PaceType = 'ハイペース' | 'ミドルペース' | 'スローペース'
export type TrackCondition = '良' | '稍重' | '重' | '不良'
export type GateBias = '内有利' | '外有利' | 'フラット'
export type MarketLabel = '過小評価' | '妙味あり' | '危険人気馬' | '本命候補' | '標準'

export interface GateTendencyResult {
  bias: GateBias
  note: string
  maxGate: number
  favoredGates: number[]
  penalizedGates: number[]
  bonusTable: Record<number, number>
}

export interface HorseDivergence {
  name: string
  aiRank: number
  popularity: number
  divergenceScore: number
  marketLabel: MarketLabel
  evScore: number
  winOdds: number
}

export interface MarketDivergenceResult {
  undervalued: HorseDivergence[]
  overvalued: HorseDivergence[]
  allHorses: HorseDivergence[]
}

export interface TrackConditionResult {
  condition: TrackCondition
  favoredStyles: RunningStyle[]
  penalizedStyles: RunningStyle[]
  evBonus: Record<RunningStyle, number>
  conditionNote: string
}

export interface StyleDistribution {
  逃げ: number
  先行: number
  差し: number
  追込: number
}

export interface PacePrediction {
  pace: PaceType
  styleDistribution: StyleDistribution
  favoredStyles: RunningStyle[]
  penalizedStyles: RunningStyle[]
  paceNote: string
  courseInteractionNote: string
  evBonus: Record<RunningStyle, number>
}

export interface CourseFeature {
  venueScale: VenueScale
  straightLength: number
  hasSlope: boolean
  distanceCategory: DistanceCategory
  favoredStyles: RunningStyle[]
  surfaceNote: string
  courseNote: string
  aiHint: string
}

export interface PastResult {
  venue: string
  distance: number
  surface: Surface
  position: number
  total: number
}

export interface Horse {
  number: number
  gate: number
  name: string
  jockey: string
  trainer: string
  age: number
  sex: string
  winOdds: number
  placeOddsMin: number
  placeOddsMax: number
  popularity: number
  style: RunningStyle
  pastResults: PastResult[]
  winRate: number
  evScore: number
  skewScore: number
  aiRank: number
  divergenceScore: number
  marketLabel: MarketLabel
  aiScore: number
  aiComment?: string
}

export interface Pick {
  betType: BetType
  horses: string[]
  odds: number
  confidence: number
  reason: string
  horseLabels?: Record<string, MarketLabel>
  signal?: 'buy' | 'pass'
  evScore?: number
}

export interface Race {
  id: string
  date: string
  venue: string
  raceNumber: number
  raceName: string
  distance: number
  surface: Surface
  grade: string
  horses: Horse[]
  picks: Pick[]
  aiComment: string
  overallEvScore: number
  courseFeature?: CourseFeature
  pacePrediction?: PacePrediction
  trackCondition?: TrackCondition
  trackConditionResult?: TrackConditionResult
  gateTendencyResult?: GateTendencyResult
  marketDivergenceResult?: MarketDivergenceResult
  optimizedBets?: OptimizedBet[]
}

export interface OptimizedBet {
  role: BetRole
  betType: BetType
  horses: string[]
  odds: number
  allocationPct: number
  reason: string
  evScore: number
  signal: 'buy' | 'pass'
  horseLabels?: Record<string, MarketLabel>
}

export interface BetRecord {
  id: string
  raceId?: string
  date: string
  venue: string
  raceNumber: number
  raceName: string
  betType: string
  horses: string[]
  odds: number
  stake: number
  evScore?: number
  aiScore: number
  aiComment: string
  isHit?: boolean
  payout: number
  profit?: number
  resultPosition?: number
  memo?: string
  isValueBet?: boolean
  marketLabel?: string
  runningStyle?: string
  aiRank?: number
  popularity?: number
  createdAt: string
}

export interface SegmentStat {
  label: string
  count: number
  winCount: number
  winRate: number
  totalAmount: number
  totalPayout: number
  returnRate: number
}

export interface StatsData {
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
  byRunningStyle: SegmentStat[]
  daily: { date: string; count: number; winCount: number; winRate: number; profit: number; returnRate: number }[]
  monthly: { month: string; count: number; winCount: number; winRate: number; profit: number; returnRate: number }[]
}

export interface LearningSegment {
  key: string
  label: string
  count: number
  winRate: number
  returnRate: number
  avgProfit: number
  isInsufficient: boolean
  correction: number
}

export interface LearningModel {
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
