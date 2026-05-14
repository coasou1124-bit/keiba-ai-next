// JRA-VAN 場コード → 競馬場名
const JRA_VENUE_CODES: Record<string, string> = {
  '01': '札幌', '1': '札幌',
  '02': '函館', '2': '函館',
  '03': '福島', '3': '福島',
  '04': '新潟', '4': '新潟',
  '05': '東京', '5': '東京',
  '06': '中山', '6': '中山',
  '07': '中京', '7': '中京',
  '08': '京都', '8': '京都',
  '09': '阪神', '9': '阪神',
  '10': '小倉',
}

const SURFACE_MAP: Record<string, string> = {
  '1': '芝', 't': '芝', 'turf': '芝', '芝': '芝',
  '2': 'ダート', 'd': 'ダート', 'dirt': 'ダート', 'ダ': 'ダート', 'ダート': 'ダート',
  '3': '障害', '障': '障害', '障害': '障害',
}

const TRACK_COND_MAP: Record<string, string> = {
  '1': '良', '良': '良',
  '2': '稍重', '稍重': '稍重', '稍': '稍重',
  '3': '重', '重': '重',
  '4': '不良', '不良': '不良',
}

const RUNNING_STYLE_MAP: Record<string, string> = {
  '1': '逃げ', '逃げ': '逃げ', '逃': '逃げ',
  '2': '先行', '先行': '先行',
  '3': '差し', '差し': '差し', '差': '差し',
  '4': '追込', '追込': '追込', '追': '追込',
  '5': '追込',
}

const WEATHER_MAP: Record<string, string> = {
  '1': '晴', '晴': '晴', '晴れ': '晴',
  '2': '曇', '曇': '曇', '曇り': '曇',
  '3': '雨', '雨': '雨',
  '4': '小雨', '小雨': '小雨',
  '5': '雪', '雪': '雪',
  '6': '小雪', '小雪': '小雪',
}

// 全角→半角変換（数字・記号）
export function toHalfWidth(s: string): string {
  return s
    .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ')
}

// 日付正規化: YYYYMMDD, YYYY/MM/DD, YYYY/M/D → YYYY-MM-DD
export function normalizeDate(s: string): string {
  const t = toHalfWidth(s.trim())
  if (!t) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(t)) return t.replace(/\//g, '-')
  const slashMatch = t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (slashMatch) return `${slashMatch[1]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[3].padStart(2, '0')}`
  if (/^\d{8}$/.test(t)) return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`
  return t
}

// 競馬場正規化: JRA場コード（01〜10）→ 名称
export function normalizeRacecourse(s: string): string {
  const t = toHalfWidth(s.trim())
  if (!t) return ''
  const byCode = JRA_VENUE_CODES[t]
  if (byCode) return byCode
  return t
}

// 馬場種別正規化
export function normalizeSurface(s: string): string {
  if (!s?.trim()) return '芝'
  const t = toHalfWidth(s.trim())
  const lower = t.toLowerCase()
  if (SURFACE_MAP[lower]) return SURFACE_MAP[lower]
  if (SURFACE_MAP[t]) return SURFACE_MAP[t]
  if (t.startsWith('芝')) return '芝'
  if (t.startsWith('ダ')) return 'ダート'
  if (t.startsWith('障')) return '障害'
  return '芝'
}

// 馬場状態正規化
export function normalizeTrackCondition(s: string): string {
  const t = toHalfWidth(s.trim())
  return TRACK_COND_MAP[t] ?? '良'
}

// 脚質正規化: 数字コード(1-4)または日本語
export function normalizeRunningStyle(s: string): string {
  const t = toHalfWidth(s.trim())
  return RUNNING_STYLE_MAP[t] ?? ''
}

// 天気正規化
export function normalizeWeather(s: string): string {
  const t = toHalfWidth(s.trim())
  return WEATHER_MAP[t] ?? t
}

// オッズ正規化: 「倍」「円」除去、JRA-VANの×10整数形式(例: "35"→3.5)を補正
export function normalizeOdds(s: string): number {
  if (!s?.trim()) return 0
  const cleaned = toHalfWidth(s.trim()).replace(/[倍円\s]/g, '').replace(',', '.')
  const v = parseFloat(cleaned)
  if (isNaN(v) || v <= 0) return 0
  // 小数点なし かつ 100以上 → ×10 形式と判断して÷10
  if (!cleaned.includes('.') && v >= 100) return v / 10
  return v
}

// 整数正規化: 数字以外を除去
export function normalizeInt(s: string, fallback = 0): number {
  if (!s?.trim()) return fallback
  const cleaned = toHalfWidth(s.trim()).replace(/[^\d]/g, '')
  const v = parseInt(cleaned, 10)
  return isNaN(v) ? fallback : v
}

// 少数正規化
export function normalizeFloat(s: string, fallback = 0): number {
  if (!s?.trim()) return fallback
  const cleaned = toHalfWidth(s.trim()).replace(/[^\d.]/g, '')
  const v = parseFloat(cleaned)
  return isNaN(v) ? fallback : v
}

// 馬名正規化: 括弧内（性別・馬齢等）を除去
export function normalizeHorseName(s: string): string {
  return toHalfWidth(s.trim()).replace(/[（(][^)）]*[)）]/g, '').trim()
}

// グレード正規化: "G 1", "g1", "ＧＩ" → "G1" 等
export function normalizeGrade(s: string): string {
  if (!s?.trim()) return ''
  const t = toHalfWidth(s.trim()).replace(/\s/g, '')
  // GI/GII/GIIIをG1/G2/G3に統一
  return t
    .replace(/^GI+II$/i, 'G3')
    .replace(/^GI+I$/i, 'G2')
    .replace(/^GI$/i, 'G1')
    .toUpperCase()
}
