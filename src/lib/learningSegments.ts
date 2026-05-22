export function popularityRangeLabel(p: number): string {
  if (p <= 0) return ''
  if (p === 1) return '1番人気'
  if (p === 2) return '2番人気'
  if (p === 3) return '3番人気'
  if (p <= 6) return '4-6番人気'
  return '7番人気以上'
}

export function aiScoreRangeLabel(s: number): string {
  if (s >= 80) return '80-100'
  if (s >= 60) return '60-79'
  if (s >= 40) return '40-59'
  return '0-39'
}
