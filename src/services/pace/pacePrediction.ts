import { Horse, RunningStyle, PaceType, StyleDistribution, PacePrediction } from '@/types'
import { CourseFeature } from '@/types'

export function calcStyleDistribution(horses: Horse[]): StyleDistribution {
  const dist: StyleDistribution = { 逃げ: 0, 先行: 0, 差し: 0, 追込: 0 }
  for (const h of horses) dist[h.style]++
  return dist
}

export function predictPace(dist: StyleDistribution): PaceType {
  const { 逃げ, 先行 } = dist
  if (逃げ >= 3) return 'ハイペース'
  if (逃げ === 2 && 先行 >= 3) return 'ハイペース'
  if (逃げ === 0) return 'スローペース'
  if (逃げ === 1 && 先行 <= 1) return 'スローペース'
  return 'ミドルペース'
}

/**
 * 脚質 × ペース × コース適性の複合 EV ボーナスを返す
 */
export function calcPaceEvBonus(
  horseStyle: RunningStyle,
  pace: PaceType,
  courseFeature?: CourseFeature
): number {
  const isLargeTrack = courseFeature?.venueScale === '大箱'

  switch (pace) {
    case 'ハイペース':
      if (horseStyle === '差し') return isLargeTrack ? 8 : 5
      if (horseStyle === '追込') return isLargeTrack ? 6 : 4
      if (horseStyle === '先行') return -4
      if (horseStyle === '逃げ') return -8
      return 0

    case 'スローペース':
      if (horseStyle === '逃げ') return isLargeTrack ? 5 : 8
      if (horseStyle === '先行') return isLargeTrack ? 3 : 6
      if (horseStyle === '差し') return -2
      if (horseStyle === '追込') return -6
      return 0

    case 'ミドルペース':
      // ミドルはコース適性補正のみ（pace補正ゼロ）
      return 0
  }
}

function buildPaceNote(pace: PaceType, dist: StyleDistribution): string {
  const { 逃げ, 先行 } = dist
  if (pace === 'ハイペース') {
    if (逃げ >= 3) {
      return `逃げ馬${逃げ}頭による激しい先行争い。ハイペース濃厚で前崩れに注意。差し・追込馬が浮上しやすい展開。`
    }
    return `逃げ${逃げ}頭・先行${先行}頭で激しいペース争い。ハイペース予想で差し馬に展開が向く。`
  }
  if (pace === 'スローペース') {
    if (逃げ === 0) {
      return `逃げ馬不在でスローペース濃厚。先行馬が楽に先手を取れる前残り展開に注意。`
    }
    return `逃げ馬${逃げ}頭のみで競り合いなし。スローから先行馬が楽に逃げる展開が予想される。`
  }
  return `逃げ${逃げ}頭・先行${先行}頭でミドルペース予想。特定脚質が圧倒的に有利とはならず、コース適性が重要。`
}

function buildCourseInteractionNote(pace: PaceType, courseFeature?: CourseFeature): string {
  if (!courseFeature) return ''

  const large = courseFeature.venueScale === '大箱'
  const longStraight = courseFeature.straightLength >= 400

  if (pace === 'ハイペース') {
    if (large && longStraight) {
      return `大箱・長直線×ハイペースで差し・追込が最大限強化。末脚重視で馬を選ぶ。`
    }
    if (!large) {
      return `小回り×ハイペースで前が苦しくなると差しが届く場面も。ペースが緩まないか序盤に注目。`
    }
    return `ハイペースで先行勢の消耗度合いが鍵。差し・追込にとっては好展開。`
  }

  if (pace === 'スローペース') {
    if (!large) {
      return `小回り×スロー展開で先行馬の粘りが最高の条件。逃げ・先行を強く推奨。`
    }
    if (longStraight) {
      return `スロー予想だが長い直線でゴール前に末脚比べになる可能性あり。先行馬の末脚も確認を。`
    }
    return `スローペースで先行有利。ただし直線でどこまで差しが来るか注意。`
  }

  const favored = courseFeature.favoredStyles[0]
  return `ミドルペース予想でコース適性が直結。${favored}有利のコースなので${favored}脚質を重視。`
}

export function buildPacePrediction(
  horses: Horse[],
  courseFeature?: CourseFeature
): PacePrediction {
  const styleDistribution = calcStyleDistribution(horses)
  const pace = predictPace(styleDistribution)

  const allStyles: RunningStyle[] = ['逃げ', '先行', '差し', '追込']
  const evBonus = Object.fromEntries(
    allStyles.map(s => [s, calcPaceEvBonus(s, pace, courseFeature)])
  ) as Record<RunningStyle, number>

  const favoredStyles = allStyles
    .filter(s => evBonus[s] > 0)
    .sort((a, b) => evBonus[b] - evBonus[a])

  const penalizedStyles = allStyles.filter(s => evBonus[s] < 0)

  return {
    pace,
    styleDistribution,
    favoredStyles,
    penalizedStyles,
    paceNote: buildPaceNote(pace, styleDistribution),
    courseInteractionNote: buildCourseInteractionNote(pace, courseFeature),
    evBonus,
  }
}
