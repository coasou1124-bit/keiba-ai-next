import { Surface, RunningStyle } from '@/types'

export type VenueScale = '大箱' | '小回り'
export type DistanceCategory = 'スプリント' | 'マイル' | '中距離' | '長距離'

export interface SurfaceProfile {
  characteristics: string[]
  favoredStyles: RunningStyle[]
  insideAdvantage: boolean
  notes: string
}

export interface CourseProfile {
  name: string
  /** ゴール前直線距離 (m) */
  straightLength: number
  hasSlope: boolean
  scale: VenueScale
  turf: SurfaceProfile
  dirt: SurfaceProfile
  generalNote: string
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

export function getDistanceCategory(distance: number): DistanceCategory {
  if (distance <= 1400) return 'スプリント'
  if (distance <= 1800) return 'マイル'
  if (distance <= 2400) return '中距離'
  return '長距離'
}

export const COURSE_PROFILES: Record<string, CourseProfile> = {
  '東京': {
    name: '東京',
    straightLength: 525,
    hasSlope: true,
    scale: '大箱',
    turf: {
      characteristics: ['最長直線525m', 'ゴール前急坂', '瞬発力勝負', 'スタミナも要求'],
      favoredStyles: ['差し', '追込'],
      insideAdvantage: false,
      notes: 'JRA最長クラスの直線と急坂のコンビで差し・追込が台頭しやすい。外枠でも不利になりにくい大箱。上がり勝負になりやすく末脚の鋭い馬が有利。',
    },
    dirt: {
      characteristics: ['右回り', '先行有利', '内枠優勢'],
      favoredStyles: ['逃げ', '先行'],
      insideAdvantage: true,
      notes: 'ダートは逃げ・先行が粘りやすい。内枠の先行馬が特に強い傾向。',
    },
    generalNote: '首都のビッグレース集中会場。芝は世界水準のコース設計でスピードとスタミナを要求する。天皇賞・秋、ジャパンCなど最高峰レース開催。',
  },

  '中山': {
    name: '中山',
    straightLength: 310,
    hasSlope: true,
    scale: '小回り',
    turf: {
      characteristics: ['急坂あり', '小回りコーナー', '内枠有利', '先行争い激化'],
      favoredStyles: ['逃げ', '先行'],
      insideAdvantage: true,
      notes: '直線が短く急坂あり。先行馬が粘りやすく差しには持続力が必要。内枠の先行馬が特に好走しやすい。タフさが求められるコース。',
    },
    dirt: {
      characteristics: ['内回り小回り', '逃げ残り多い', '内枠有利'],
      favoredStyles: ['逃げ', '先行'],
      insideAdvantage: true,
      notes: 'ダートも先行馬が強い。逃げ馬が残るケースが多い小回りコース。',
    },
    generalNote: '有馬記念の舞台。タフなコース設定で体力ある馬が有利。内枠先行が基本セオリーだが急坂をこなせるスタミナも必須。',
  },

  '京都': {
    name: '京都',
    straightLength: 404,
    hasSlope: true,
    scale: '大箱',
    turf: {
      characteristics: ['外回り404m直線', '3コーナー下り坂', '外回りは差し有利', '内回りは先行有利'],
      favoredStyles: ['差し', '先行'],
      insideAdvantage: false,
      notes: '外回りコースは長い直線で差しが台頭。3コーナーからの下り坂で後方馬が加速しやすい。内回りは小回りで先行有利と全く異なる特性。',
    },
    dirt: {
      characteristics: ['先行有利', '内枠優勢'],
      favoredStyles: ['先行', '逃げ'],
      insideAdvantage: true,
      notes: 'ダートは先行馬が安定して好走。',
    },
    generalNote: '2023年リニューアル後より差し馬に有利な設計に。3コーナーの下り坂が最大の特徴。菊花賞など長距離重賞が多く組まれる。',
  },

  '阪神': {
    name: '阪神',
    straightLength: 473,
    hasSlope: true,
    scale: '大箱',
    turf: {
      characteristics: ['外回り473m直線', 'ゴール前急坂', '外回りは差し有利', '内回りは先行有利'],
      favoredStyles: ['差し', '追込'],
      insideAdvantage: false,
      notes: '外回りは東京に次ぐ長い直線と急坂で差し・追込が有利。内回りは小回りで先行馬が粘りやすい。急坂があるため消耗戦でもスタミナが問われる。',
    },
    dirt: {
      characteristics: ['先行・逃げが強い', '内枠有利'],
      favoredStyles: ['先行', '逃げ'],
      insideAdvantage: true,
      notes: 'ダートコースは先行馬が圧倒的に有利。逃げ馬のワンマンショーになることも。',
    },
    generalNote: '関西の主要競馬場。急坂が特徴的でスタミナある差し馬が台頭。宝塚記念、阪神JFなど関西圏の主要GI多数。',
  },

  '中京': {
    name: '中京',
    straightLength: 412,
    hasSlope: false,
    scale: '大箱',
    turf: {
      characteristics: ['412m直線', '平坦', '瞬発力勝負', '差し台頭しやすい'],
      favoredStyles: ['差し', '先行'],
      insideAdvantage: false,
      notes: '平坦な長い直線で瞬発力勝負になりやすい。差し馬が台頭する場面も多い。坂がないため先行馬のスタミナロスが少なく競り合いになることも。',
    },
    dirt: {
      characteristics: ['先行有利', 'ハイペースになりやすい'],
      favoredStyles: ['先行', '逃げ'],
      insideAdvantage: false,
      notes: 'ダートはペースが速くなりやすく先行馬の消耗も激しい場合あり。',
    },
    generalNote: '名古屋エリアの競馬場。高松宮記念などGI開催。平坦コースでスピード能力が直結する。',
  },

  '新潟': {
    name: '新潟',
    straightLength: 658,
    hasSlope: false,
    scale: '大箱',
    turf: {
      characteristics: ['外回り658m直線（JRA最長）', '平坦', '差し・追込圧倒的有利', '直線1000mコースあり'],
      favoredStyles: ['差し', '追込'],
      insideAdvantage: false,
      notes: 'JRA最長658mの直線を誇る外回り。平坦かつ超長い直線で差し・追込が圧倒的に有利。内回りは先行有利と正反対の特性を持つ珍しい競馬場。',
    },
    dirt: {
      characteristics: ['先行有利', '内枠優勢'],
      favoredStyles: ['先行', '逃げ'],
      insideAdvantage: true,
      notes: 'ダートは先行有利の傾向。',
    },
    generalNote: '夏競馬の主要会場。外回りはJRA最長直線で差し馬に圧倒的有利。直線1000mという特殊コースも存在し独特の競馬が展開される。',
  },

  '福島': {
    name: '福島',
    straightLength: 292,
    hasSlope: false,
    scale: '小回り',
    turf: {
      characteristics: ['292m直線', '平坦小回り', '先行・逃げが有利', '内枠有利'],
      favoredStyles: ['逃げ', '先行'],
      insideAdvantage: true,
      notes: '短い直線の平坦小回りコース。先行馬・逃げ馬が粘りやすく差しには絶好の展開が必要。内枠の先行馬を狙うのが基本セオリー。',
    },
    dirt: {
      characteristics: ['先行圧倒的有利', '逃げ残り多い'],
      favoredStyles: ['逃げ', '先行'],
      insideAdvantage: true,
      notes: 'ダートも先行馬が強い典型的な小回りコース。',
    },
    generalNote: '夏の福島開催。小回り平坦で先行馬が粘りやすい。差し馬には厳しいコース設計。',
  },

  '小倉': {
    name: '小倉',
    straightLength: 293,
    hasSlope: false,
    scale: '小回り',
    turf: {
      characteristics: ['293m直線', '平坦', '逃げ・先行有利', '小回りコーナー'],
      favoredStyles: ['逃げ', '先行'],
      insideAdvantage: true,
      notes: '九州の平坦小回りコース。逃げ・先行馬が圧倒的に有利。小回りのためコーナーでの位置取りが重要で内枠が有利になりやすい。',
    },
    dirt: {
      characteristics: ['先行有利', '逃げ残り多い'],
      favoredStyles: ['逃げ', '先行'],
      insideAdvantage: true,
      notes: 'ダートも典型的な先行有利の小回りコース。',
    },
    generalNote: '九州・小倉競馬場。コンパクトな小回りで逃げ先行が強い。冬から春が主な開催時期で小倉記念など重賞も開催。',
  },

  '札幌': {
    name: '札幌',
    straightLength: 264,
    hasSlope: false,
    scale: '小回り',
    turf: {
      characteristics: ['264m直線', '平坦', '洋芝でパワー型有利', '小回り'],
      favoredStyles: ['逃げ', '先行'],
      insideAdvantage: true,
      notes: '北海道の洋芝コース。芝が深く消耗戦になりやすい。パワー型の先行馬が有利で差し馬には道悪・消耗展開が必要。洋芝経験が問われる。',
    },
    dirt: {
      characteristics: ['先行有利', 'パワー型優勢'],
      favoredStyles: ['先行', '逃げ'],
      insideAdvantage: true,
      notes: 'ダートは先行有利。洋芝の影響でパワーが求められる。',
    },
    generalNote: '夏の北海道シリーズ。洋芝でパワーとスタミナが問われる消耗戦傾向が強い。洋芝実績を必ずチェック。',
  },

  '函館': {
    name: '函館',
    straightLength: 262,
    hasSlope: false,
    scale: '小回り',
    turf: {
      characteristics: ['262m直線（JRA最短）', '平坦', '逃げ圧倒的有利', '洋芝・消耗戦'],
      favoredStyles: ['逃げ', '先行'],
      insideAdvantage: true,
      notes: 'JRA最短の直線を持つ小回り洋芝コース。逃げ馬が圧倒的に有利で差しはほぼ届かない。洋芝はスタミナを要求し消耗戦になりやすい。',
    },
    dirt: {
      characteristics: ['逃げ残り最多', '先行有利'],
      favoredStyles: ['逃げ', '先行'],
      insideAdvantage: true,
      notes: 'ダートも逃げ馬が残りやすい。JRA一逃げ馬に有利なコース。',
    },
    generalNote: '北海道・函館競馬場。JRA最短直線で逃げ馬の楽園。洋芝開催で消耗戦になりやすく洋芝実績が重要。',
  },
}

export function getCourseProfile(venue: string): CourseProfile | undefined {
  return COURSE_PROFILES[venue]
}

export function getCourseFeature(
  venue: string,
  surface: Surface,
  distance: number
): CourseFeature | undefined {
  const profile = getCourseProfile(venue)
  if (!profile) return undefined

  const sp = surface === '芝' ? profile.turf : profile.dirt
  const distanceCategory = getDistanceCategory(distance)

  // 長距離では差し・追込もフォローアップ
  const favoredStyles: RunningStyle[] = [...sp.favoredStyles]
  if (distance >= 2400 && !favoredStyles.includes('差し')) {
    favoredStyles.push('差し')
  }

  const slopeText = profile.hasSlope ? '急坂あり' : '平坦'
  const insideText = sp.insideAdvantage ? '・内枠有利' : ''
  const styleText = favoredStyles.join('・')
  const aiHint =
    `${profile.name}${distance}m（${distanceCategory}）は${profile.scale}・直線${profile.straightLength}m・${slopeText}${insideText}。` +
    `${styleText}が有利。${sp.notes}`

  return {
    venueScale: profile.scale,
    straightLength: profile.straightLength,
    hasSlope: profile.hasSlope,
    distanceCategory,
    favoredStyles,
    surfaceNote: sp.notes,
    courseNote: profile.generalNote,
    aiHint,
  }
}

/**
 * 脚質とコース適性の相性スコアを返す (+8 / +4 / -4)
 */
export function calcCourseStyleBonus(
  horseStyle: RunningStyle,
  venue: string,
  surface: Surface
): number {
  const profile = getCourseProfile(venue)
  if (!profile) return 0

  const sp = surface === '芝' ? profile.turf : profile.dirt
  const rank = sp.favoredStyles.indexOf(horseStyle)

  if (rank === 0) return 8
  if (rank === 1) return 4
  return -4
}
