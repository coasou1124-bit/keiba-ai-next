'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  normalizeDate, normalizeRacecourse, normalizeSurface, normalizeTrackCondition,
  normalizeRunningStyle, normalizeOdds, normalizeInt, normalizeFloat,
  normalizeHorseName, normalizeGrade, normalizeWeather, toHalfWidth,
} from '@/lib/csvNormalize'

interface ImportedRaceSummary {
  id: string
  raceDate: string
  racecourse: string
  raceNumber: number
  raceName: string
  surface: string
  distance: number
  trackCondition: string
  raceGrade: string
  _count: { horses: number }
}

interface ImportStats {
  totalRaces: number
  totalHorses: number
}

interface ParsedHorse {
  horseName: string
  frameNumber: number
  horseNumber: number
  popularity: number
  odds: number
  runningStyle: string
  finalPosition: number
  jockeyName: string
  weightCarried: number
  horseSex: string
  horseAge: number
}

interface ParsedRace {
  raceDate: string
  racecourse: string
  raceNumber: number
  raceName: string
  surface: string
  distance: number
  trackCondition: string
  raceGrade: string
  horses: ParsedHorse[]
}

type PreviewIssue = { level: 'error' | 'warn'; row: number; field: string; msg: string }
type PreviewResult = { races: ParsedRace[]; issues: PreviewIssue[] }

// ---- Field mapping ----
const APP_FIELDS = [
  { key: 'raceDate',       label: '開催日',     required: true,  hint: 'YYYY-MM-DD' },
  { key: 'racecourse',     label: '競馬場',     required: true,  hint: '東京/京都/場コード' },
  { key: 'raceNumber',     label: 'レース番号', required: true,  hint: '1〜12' },
  { key: 'raceName',       label: 'レース名',   required: false, hint: '' },
  { key: 'raceGrade',      label: 'グレード',   required: false, hint: 'G1/G2/G3 等' },
  { key: 'surface',        label: '馬場種別',   required: false, hint: '芝/ダート/数字コード' },
  { key: 'distance',       label: '距離(m)',    required: false, hint: '' },
  { key: 'weather',        label: '天気',       required: false, hint: '晴/曇/雨/数字コード' },
  { key: 'trackCondition', label: '馬場状態',   required: false, hint: '良/稍重/重/不良' },
  { key: 'horseName',      label: '馬名',       required: true,  hint: '' },
  { key: 'frameNumber',    label: '枠番',       required: false, hint: '1〜8' },
  { key: 'horseNumber',    label: '馬番',       required: false, hint: '1〜18' },
  { key: 'popularity',     label: '人気',       required: false, hint: '' },
  { key: 'odds',           label: '単勝オッズ', required: false, hint: '' },
  { key: 'runningStyle',   label: '脚質',       required: false, hint: '逃げ/先行/差し/追込/数字' },
  { key: 'finalPosition',  label: '着順',       required: false, hint: '1〜18' },
  { key: 'jockeyName',     label: '騎手名',     required: false, hint: '' },
  { key: 'weightCarried',  label: '斤量',       required: false, hint: 'kg' },
  { key: 'horseSex',       label: '性別',       required: false, hint: '牡/牝/セ' },
  { key: 'horseAge',       label: '馬齢',       required: false, hint: '2〜9' },
] as const

type AppFieldKey = typeof APP_FIELDS[number]['key']
type FieldMapping = Record<AppFieldKey, string>

const FIELD_ALIASES: Record<AppFieldKey, readonly string[]> = {
  raceDate: [
    'raceDate', 'race_date', '日付', '開催日', '開催年月日', '競走年月日', '年月日', 'date',
  ],
  racecourse: [
    'racecourse', 'venue', '競馬場', '開催場', '開催競馬場', '場名', 'track',
    '場コード', '競馬場コード', '開催場所', '場所', '開催場名', '競走場',
  ],
  raceNumber: [
    'raceNumber', 'race_number', 'レース番号', 'レースNo', 'R', 'r番',
    '競走番号', 'レースNo.', 'R番号', '競走No',
  ],
  raceName: [
    'raceName', 'race_name', 'レース名', '競走名', '競走名略称', 'レース名称',
  ],
  raceGrade: [
    'raceGrade', 'race_grade', 'グレード', 'grade', '競走条件', 'クラス',
    '競走種別名', 'レース条件',
  ],
  surface: [
    'surface', '馬場', '馬場種別', '芝ダート', '種別', '芝ダ',
    '競走種別', '芝・ダート', '芝ダ区分',
  ],
  distance: [
    'distance', '距離', 'dist', '距離(m)', '距離（m）', 'キョリ',
  ],
  weather: [
    'weather', '天気', '天候', '天候コード',
  ],
  trackCondition: [
    'trackCondition', 'track_condition', '馬場状態', '状態', 'condition',
    '馬場状態コード', '馬場コード', 'ババ',
  ],
  horseName: [
    'horseName', 'horse_name', '馬名', 'name', '競走馬名', '馬名（カナ）', '馬名カナ',
  ],
  frameNumber: [
    'frameNumber', 'frame_number', '枠番', '枠', 'frame', '枠番号',
  ],
  horseNumber: [
    'horseNumber', 'horse_number', '馬番', '番号', '馬番号', '馬No', '馬No.',
  ],
  popularity: [
    'popularity', '人気', '人気順', '人気順位', '単勝人気', '単勝人気順',
    '単勝人気順位', '人気(単)', 'pop',
  ],
  odds: [
    'odds', '単勝オッズ', '単勝', 'win_odds', 'winOdds', 'オッズ', '単オッズ',
    '単勝(オッズ)', '単勝配当',
  ],
  runningStyle: [
    'runningStyle', 'running_style', '脚質', 'style', '脚質コード', '脚質区分',
  ],
  finalPosition: [
    'finalPosition', 'final_position', '着順', '確定着順', '入線順位', '着',
    'result', '着順(確定)',
  ],
  jockeyName: [
    'jockeyName', 'jockey_name', '騎手名', '騎手', 'jockey', '騎手氏名',
    '騎手名(略)', '騎乗者',
  ],
  weightCarried: [
    'weightCarried', 'weight_carried', '斤量', '負担重量', 'weight',
    'carry_weight',
  ],
  horseSex: [
    'horseSex', 'horse_sex', '性別', '性', 'sex', '性別コード',
  ],
  horseAge: [
    'horseAge', 'horse_age', '馬齢', '年齢', 'age',
  ],
}

// v2: フィールド数増加のため保存形式を更新
const MAPPING_KEY = 'keibaCSVFieldMapping_v2'

function emptyMapping(): FieldMapping {
  const m = {} as FieldMapping
  APP_FIELDS.forEach(f => { (m as Record<string, string>)[f.key] = '' })
  return m
}

function autoDetectMapping(headers: string[]): FieldMapping {
  const mapping = emptyMapping()
  for (const field of APP_FIELDS) {
    for (const alias of FIELD_ALIASES[field.key as AppFieldKey]) {
      const found = headers.find(h => h.toLowerCase() === alias.toLowerCase())
      if (found) { (mapping as Record<string, string>)[field.key] = found; break }
    }
  }
  return mapping
}

function loadSavedMapping(): FieldMapping | null {
  try {
    const stored = localStorage.getItem(MAPPING_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as Partial<Record<string, string>>
    const m = emptyMapping()
    APP_FIELDS.forEach(f => {
      if (typeof parsed[f.key] === 'string') (m as Record<string, string>)[f.key] = parsed[f.key]!
    })
    return m
  } catch { return null }
}

// クオート対応CSVパーサー（クライアント側）
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += ch }
  }
  result.push(current.trim())
  return result
}

function extractHeaders(csvText: string): string[] {
  const firstLine = csvText
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n')
    .find(l => l.trim() && !l.startsWith('#'))
  if (!firstLine) return []
  return parseCSVLine(firstLine).map(h => h.replace(/^"|"$/g, ''))
}

function applyMappingToCSV(csvText: string, mapping: FieldMapping): string {
  const lines = csvText
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
  if (lines.length < 2) return csvText

  const origHeaders = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ''))
  const mappedFields = APP_FIELDS
    .map(f => f.key as AppFieldKey)
    .filter(k => (mapping as Record<string, string>)[k])

  const newHeader = mappedFields.join(',')
  const dataRows = lines.slice(1).map(line => {
    const values = parseCSVLine(line).map(v => v.replace(/^"|"$/g, ''))
    const rowObj: Record<string, string> = {}
    origHeaders.forEach((h, i) => { rowObj[h] = values[i] ?? '' })
    return mappedFields.map(k => {
      const col = (mapping as Record<string, string>)[k]
      return col ? (rowObj[col] ?? '') : ''
    }).join(',')
  })

  return [newHeader, ...dataRows].join('\n')
}

function parseCSVPreview(content: string): PreviewResult | null {
  try {
    const lines = content
      .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .split('\n')
      .filter(l => l.trim() && !l.startsWith('#'))
    if (lines.length < 2) return null

    const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ''))
    const raceMap = new Map<string, ParsedRace>()
    const issues: PreviewIssue[] = []

    lines.slice(1).forEach((line, idx) => {
      const rowNum = idx + 2
      const values = parseCSVLine(line).map(v => v.replace(/^"|"$/g, ''))
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = values[i] ?? '' })

      const horseName = normalizeHorseName(row.horseName ?? '')
      if (!horseName) {
        issues.push({ level: 'error', row: rowNum, field: 'horseName', msg: '馬名が空欄 — この行をスキップ' })
        return
      }

      const rawDate = row.raceDate?.trim() ?? ''
      const raceDate = normalizeDate(rawDate)
      if (!rawDate) {
        issues.push({ level: 'error', row: rowNum, field: 'raceDate', msg: '開催日が空欄' })
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(raceDate)) {
        issues.push({ level: 'error', row: rowNum, field: 'raceDate', msg: `日付形式エラー: "${rawDate}"` })
      } else if (raceDate !== rawDate) {
        issues.push({ level: 'warn', row: rowNum, field: 'raceDate', msg: `"${rawDate}" → "${raceDate}"` })
      }

      const rawSurface = row.surface?.trim() ?? ''
      const surface = normalizeSurface(rawSurface)
      if (rawSurface && rawSurface !== surface) {
        issues.push({ level: 'warn', row: rowNum, field: 'surface', msg: `馬場 "${rawSurface}" → "${surface}"` })
      }

      const rawCond = row.trackCondition?.trim() ?? ''
      const trackCondition = normalizeTrackCondition(rawCond)
      if (rawCond && rawCond !== trackCondition) {
        issues.push({ level: 'warn', row: rowNum, field: 'trackCondition', msg: `馬場状態 "${rawCond}" → "${trackCondition}"` })
      }

      const rawOdds = row.odds?.trim() ?? ''
      const odds = normalizeOdds(rawOdds)
      if (rawOdds && odds === 0) {
        issues.push({ level: 'warn', row: rowNum, field: 'odds', msg: `オッズ無効: "${rawOdds}"` })
      } else if (rawOdds && rawOdds !== String(odds) && rawOdds !== odds.toFixed(1)) {
        issues.push({ level: 'warn', row: rowNum, field: 'odds', msg: `オッズ "${rawOdds}" → ${odds}` })
      }

      const rawStyle = row.runningStyle?.trim() ?? ''
      const runningStyle = normalizeRunningStyle(rawStyle)
      if (rawStyle && !runningStyle && rawStyle !== runningStyle) {
        issues.push({ level: 'warn', row: rowNum, field: 'runningStyle', msg: `脚質 "${rawStyle}" 未認識` })
      }

      const racecourse = normalizeRacecourse(row.racecourse ?? '')
      const raceNumber = normalizeInt(row.raceNumber ?? '', 0)
      const key = `${raceDate}__${racecourse}__${raceNumber}`

      if (!raceMap.has(key)) {
        raceMap.set(key, {
          raceDate,
          racecourse,
          raceNumber,
          raceName: toHalfWidth(row.raceName?.trim() ?? ''),
          surface,
          distance: normalizeInt(row.distance ?? '', 1600) || 1600,
          trackCondition,
          raceGrade: normalizeGrade(row.raceGrade ?? ''),
          horses: [],
        })
      }

      raceMap.get(key)!.horses.push({
        horseName,
        frameNumber: normalizeInt(row.frameNumber ?? '', 1) || 1,
        horseNumber: normalizeInt(row.horseNumber ?? '', 1) || 1,
        popularity: normalizeInt(row.popularity ?? '', 0),
        odds: odds || 1.0,
        runningStyle,
        finalPosition: normalizeInt(row.finalPosition ?? '', 0),
        jockeyName: toHalfWidth(row.jockeyName?.trim() ?? ''),
        weightCarried: normalizeFloat(row.weightCarried ?? '', 0),
        horseSex: toHalfWidth(row.horseSex?.trim() ?? ''),
        horseAge: normalizeInt(row.horseAge ?? '', 0),
      })
    })

    const races = Array.from(raceMap.values()).filter(r => r.horses.length > 0)
    return { races, issues }
  } catch {
    return null
  }
}

const CSV_TEMPLATE = `raceDate,racecourse,raceNumber,raceName,raceGrade,surface,distance,weather,trackCondition,horseName,frameNumber,horseNumber,popularity,odds,runningStyle,finalPosition,jockeyName,weightCarried
2026-05-15,東京,11,東京優駿（日本ダービー）,G1,芝,2400,晴,良,ホープフルスター,1,1,1,3.5,先行,1,ルメール,57
2026-05-15,東京,11,東京優駿（日本ダービー）,G1,芝,2400,晴,良,サクラコスモス,1,2,2,5.2,差し,3,横山典弘,57
2026-05-15,東京,11,東京優駿（日本ダービー）,G1,芝,2400,晴,良,ウィンドブレイカー,2,3,3,7.8,逃げ,2,戸崎圭太,57
2026-05-15,東京,11,東京優駿（日本ダービー）,G1,芝,2400,晴,良,ゴールデンフリート,2,4,4,10.2,追込,4,川田将雅,57
2026-05-15,京都,9,葵ステークス,,芝,1200,曇,稍重,ライトニングラン,1,1,1,4.1,逃げ,2,岩田康誠,55
2026-05-15,京都,9,葵ステークス,,芝,1200,曇,稍重,クリスタルウィング,1,2,2,6.3,先行,1,武豊,55
2026-05-15,京都,9,葵ステークス,,芝,1200,曇,稍重,ヴェルデカラー,2,3,3,8.5,差し,3,福永祐一,55`

const SURFACE_COLOR: Record<string, string> = {
  '芝': 'text-green-400',
  'ダート': 'text-amber-400',
}

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload flow
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload')
  const [rawCsvText, setRawCsvText] = useState('')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>(emptyMapping())
  const [autoMapping, setAutoMapping] = useState<FieldMapping>(emptyMapping())
  const [remappedCsv, setRemappedCsv] = useState('')
  const [mappingError, setMappingError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ParsedRace[] | null>(null)

  // Import
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    ok: boolean; message: string; warnings?: string[]
  } | null>(null)
  const [previewIssues, setPreviewIssues] = useState<PreviewIssue[]>([])

  // Existing data
  const [importedRaces, setImportedRaces] = useState<ImportedRaceSummary[]>([])
  const [stats, setStats] = useState<ImportStats | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Filters
  const [filterDate, setFilterDate] = useState('')
  const [filterVenue, setFilterVenue] = useState('')
  const [filterSurface, setFilterSurface] = useState('')

  const fetchList = () => {
    setLoadingList(true)
    fetch('/api/import')
      .then(r => r.json())
      .then((d: { races?: ImportedRaceSummary[]; stats?: ImportStats }) => {
        setImportedRaces(d.races ?? [])
        if (d.stats) setStats(d.stats)
        setLoadingList(false)
      })
      .catch(() => setLoadingList(false))
  }

  useEffect(() => { fetchList() }, [])

  const filteredRaces = useMemo(() =>
    importedRaces.filter(r => {
      if (filterDate && r.raceDate !== filterDate) return false
      if (filterVenue && r.racecourse !== filterVenue) return false
      if (filterSurface && r.surface !== filterSurface) return false
      return true
    }),
    [importedRaces, filterDate, filterVenue, filterSurface]
  )

  const uniqueVenues = useMemo(() =>
    Array.from(new Set(importedRaces.map(r => r.racecourse))).sort(),
    [importedRaces]
  )

  const importedRaceKeys = useMemo(() =>
    new Set(importedRaces.map(r => `${r.raceDate}__${r.racecourse}__${r.raceNumber}`)),
    [importedRaces]
  )

  // Derived mapping
  const requiredUnmapped = APP_FIELDS.filter(f => f.required && !(fieldMapping as Record<string, string>)[f.key])
  const allRequiredDetected = APP_FIELDS.filter(f => f.required).every(f => !!(autoMapping as Record<string, string>)[f.key])
  const detectedCount = APP_FIELDS.filter(f => !!(autoMapping as Record<string, string>)[f.key]).length

  const handleFileLoad = (text: string) => {
    setRawCsvText(text)
    setImportResult(null)
    setPreview(null)
    setRemappedCsv('')
    setMappingError(null)

    const headers = extractHeaders(text)
    if (headers.length === 0) {
      setCsvHeaders([])
      setStep('upload')
      return
    }
    setCsvHeaders(headers)

    const detected = autoDetectMapping(headers)
    setAutoMapping(detected)

    const saved = loadSavedMapping()
    const merged = { ...detected }
    if (saved) {
      APP_FIELDS.forEach(f => {
        const savedCol = (saved as Record<string, string>)[f.key]
        if (savedCol && headers.includes(savedCol)) {
          (merged as Record<string, string>)[f.key] = savedCol
        }
      })
    }
    setFieldMapping(merged)
    setStep('mapping')
  }

  const readFileWithEncoding = (file: File) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const buffer = ev.target?.result as ArrayBuffer
      // UTF-8で試みて、置換文字（U+FFFD）があればShift-JISで再デコード
      const utf8 = new TextDecoder('utf-8').decode(buffer)
      const text = utf8.includes('�')
        ? new TextDecoder('shift-jis').decode(buffer)
        : utf8
      handleFileLoad(text)
    }
    reader.readAsArrayBuffer(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    readFileWithEncoding(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    readFileWithEncoding(file)
  }

  const handleFileReset = () => {
    setRawCsvText('')
    setCsvHeaders([])
    setFieldMapping(emptyMapping())
    setAutoMapping(emptyMapping())
    setRemappedCsv('')
    setPreview(null)
    setPreviewIssues([])
    setMappingError(null)
    setImportResult(null)
    setStep('upload')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleConfirmMapping = () => {
    const missing = APP_FIELDS.filter(f => f.required && !(fieldMapping as Record<string, string>)[f.key])
    if (missing.length > 0) {
      setMappingError(`必須項目が未設定です: ${missing.map(f => f.label).join('、')}`)
      return
    }
    setMappingError(null)

    const remapped = applyMappingToCSV(rawCsvText, fieldMapping)
    setRemappedCsv(remapped)
    const result = parseCSVPreview(remapped)
    setPreview(result?.races ?? null)
    setPreviewIssues(result?.issues ?? [])

    try { localStorage.setItem(MAPPING_KEY, JSON.stringify(fieldMapping)) } catch { /* ignore */ }

    setStep('preview')
  }

  const handleImport = async () => {
    if (!remappedCsv) return
    setImporting(true)
    setImportResult(null)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: remappedCsv }),
      })
      const data = await res.json() as {
        success?: boolean; message?: string; error?: string
        created?: number; updated?: number; horses?: number; warnings?: string[]
      }
      if (res.ok && data.success) {
        setImportResult({ ok: true, message: data.message ?? '取込完了', warnings: data.warnings })
        setRawCsvText(''); setCsvHeaders([]); setFieldMapping(emptyMapping())
        setAutoMapping(emptyMapping()); setRemappedCsv(''); setPreview(null)
        setPreviewIssues([]); setMappingError(null); setStep('upload')
        if (fileInputRef.current) fileInputRef.current.value = ''
        fetchList()
      } else {
        setImportResult({ ok: false, message: data.error ?? 'インポートに失敗しました' })
      }
    } catch {
      setImportResult({ ok: false, message: 'ネットワークエラーが発生しました' })
    }
    setImporting(false)
  }

  const handleDeleteRace = async (id: string, label: string) => {
    if (!window.confirm(`「${label}」を削除しますか？`)) return
    setDeletingId(id)
    try {
      const horseCount = importedRaces.find(r => r.id === id)?._count.horses ?? 0
      await fetch(`/api/import?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      setImportedRaces(prev => prev.filter(r => r.id !== id))
      setStats(prev => prev
        ? { totalRaces: prev.totalRaces - 1, totalHorses: prev.totalHorses - horseCount }
        : prev
      )
    } catch { /* ignore */ }
    setDeletingId(null)
  }

  const handleClear = async () => {
    const count = stats?.totalRaces ?? importedRaces.length
    if (!window.confirm(`取込済みデータ（${count}レース）をすべて削除しますか？\n削除後はモックデータが表示されます。`)) return
    setClearing(true)
    try {
      await fetch('/api/import', { method: 'DELETE' })
      setImportedRaces([])
      setStats({ totalRaces: 0, totalHorses: 0 })
    } catch { /* ignore */ }
    setClearing(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(CSV_TEMPLATE).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const hasFilters = !!(filterDate || filterVenue || filterSurface)
  const newCount = preview ? preview.filter(r => !importedRaceKeys.has(`${r.raceDate}__${r.racecourse}__${r.raceNumber}`)).length : 0
  const dupCount = preview ? preview.length - newCount : 0

  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 md:pb-8 pt-6">
      <div className="mb-6">
        <h1 className="text-amber-400 font-bold text-2xl">CSVデータ取込</h1>
        <p className="text-white/50 text-sm mt-1">JRAレースデータをCSVから一括インポートしてAI分析・統計に反映します</p>
      </div>

      {stats && stats.totalRaces > 0 && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold text-2xl">{stats.totalRaces}</span>
            <span className="text-white/55 text-sm">レース取込済</span>
          </div>
          <div className="w-px h-5 bg-white/10 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold text-2xl">{stats.totalHorses}</span>
            <span className="text-white/55 text-sm">頭</span>
          </div>
          <div className="ml-auto">
            <Link href="/" className="text-xs px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors">
              ホームで分析を見る →
            </Link>
          </div>
        </div>
      )}

      {/* CSV Template */}
      <section className="mb-8">
        <h2 className="text-amber-400 font-bold text-lg mb-3">CSVテンプレート</h2>
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
            <span className="text-white/40 text-xs font-mono">sample.csv — コピーして自分のデータに書き換えてください</span>
            <button
              onClick={handleCopy}
              className={`text-xs px-3 py-1 rounded border transition-colors ${
                copied ? 'border-green-500/40 text-green-400' : 'border-white/20 text-white/50 hover:text-white/80 hover:border-white/40'
              }`}
            >
              {copied ? 'コピー完了' : 'コピー'}
            </button>
          </div>
          <pre className="text-xs text-white/65 font-mono px-4 py-3 overflow-x-auto leading-relaxed whitespace-pre">
            {CSV_TEMPLATE}
          </pre>
        </div>
        <p className="text-white/30 text-xs mt-2">
          ※ ヘッダー名が異なる場合（JRA-VAN等）は取込時に列マッピングで対応付けできます。
        </p>
      </section>

      {/* File Upload Section */}
      <section className="mb-8">
        <h2 className="text-amber-400 font-bold text-lg mb-3">CSVファイルを選択</h2>

        {/* Step: upload */}
        {step === 'upload' && (
          <div
            className="border-2 border-dashed border-white/20 rounded-xl p-10 text-center hover:border-amber-400/40 hover:bg-white/3 transition-all cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onDragEnter={e => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add('border-amber-400/60') }}
            onDragLeave={e => { (e.currentTarget as HTMLElement).classList.remove('border-amber-400/60') }}
          >
            <div className="text-white/30 text-4xl mb-3 select-none">↑</div>
            <p className="text-white/60 text-sm font-medium mb-1">クリックまたはドラッグ＆ドロップ</p>
            <p className="text-white/30 text-xs">UTF-8エンコードの .csv ファイル</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {/* Step: mapping */}
        {step === 'mapping' && (
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-white/85 text-sm font-medium">列マッピング設定</h3>
                <p className="text-white/40 text-xs mt-0.5 truncate">
                  検出された列（{csvHeaders.length}列）: <span className="font-mono">{csvHeaders.join(', ')}</span>
                </p>
              </div>
              <button
                onClick={handleFileReset}
                className="shrink-0 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                ← 選び直す
              </button>
            </div>

            {allRequiredDetected && (
              <div className="px-4 py-2.5 bg-green-500/10 border-b border-green-500/20 flex items-center gap-2">
                <span className="text-green-400 text-sm">✓</span>
                <span className="text-green-400/90 text-xs">
                  全必須項目が自動検出されました（{detectedCount} / {APP_FIELDS.length} 項目マッチ）— そのまま確定できます
                </span>
              </div>
            )}

            <div className="p-4 space-y-1.5">
              {APP_FIELDS.map(field => {
                const fKey = field.key as AppFieldKey
                const currentVal = (fieldMapping as Record<string, string>)[fKey]
                const autoVal = (autoMapping as Record<string, string>)[fKey]
                const isAutoMapped = !!autoVal && currentVal === autoVal
                const isUserChanged = !!currentVal && currentVal !== autoVal
                const isMissing = field.required && !currentVal
                return (
                  <div
                    key={fKey}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      isMissing ? 'bg-red-500/8 border border-red-500/20' : 'hover:bg-white/3'
                    }`}
                  >
                    <div className="w-36 shrink-0">
                      <span className="text-amber-300/80 font-mono text-xs">{fKey}</span>
                      {field.required && <span className="text-red-400 ml-0.5 text-xs">*</span>}
                    </div>
                    <div className="w-20 shrink-0 text-white/35 text-xs hidden sm:block">{field.label}</div>
                    <select
                      value={currentVal}
                      onChange={e => {
                        const next = { ...fieldMapping } as Record<string, string>
                        next[fKey] = e.target.value
                        setFieldMapping(next as FieldMapping)
                        setMappingError(null)
                      }}
                      className={`flex-1 bg-white/5 border rounded-lg px-2 py-1.5 text-xs text-white/75 focus:outline-none transition-colors ${
                        isMissing
                          ? 'border-red-500/40 focus:border-red-500/60'
                          : 'border-white/15 focus:border-amber-500/50'
                      }`}
                    >
                      <option value="">{field.required ? '(必須・未設定)' : '(マッピングしない)'}</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <div className="w-10 shrink-0 text-right text-xs">
                      {isAutoMapped && <span className="text-green-400/65">自動</span>}
                      {isUserChanged && <span className="text-amber-400/65">変更</span>}
                    </div>
                  </div>
                )
              })}
            </div>

            {mappingError && (
              <div className="mx-4 mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                {mappingError}
              </div>
            )}

            <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between gap-4 flex-wrap">
              <span className="text-white/25 text-xs">* 必須 | マッピング設定はブラウザに自動保存されます</span>
              <button
                onClick={handleConfirmMapping}
                disabled={requiredUnmapped.length > 0}
                className={`px-5 py-2 rounded-xl font-bold text-sm transition-colors ${
                  requiredUnmapped.length > 0
                    ? 'bg-white/10 text-white/30 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 text-black'
                }`}
              >
                確定してプレビューへ →
              </button>
            </div>
          </div>
        )}

        {/* Step: preview */}
        {step === 'preview' && (
          <>
            {preview !== null && preview.length === 0 ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm flex items-start justify-between gap-4">
                <span>CSVを解析できませんでした。マッピング設定を確認してください。</span>
                <button onClick={() => setStep('mapping')} className="shrink-0 text-xs text-white/50 hover:text-white/80 transition-colors">
                  ← マッピングに戻る
                </button>
              </div>
            ) : preview && preview.length > 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => setStep('mapping')}
                    className="text-xs text-white/40 hover:text-white/70 transition-colors"
                  >
                    ← マッピングに戻る
                  </button>
                  <div className="w-px h-4 bg-white/10" />
                  <p className="text-white/70 text-sm font-medium">
                    プレビュー —
                    <span className="text-amber-300 ml-1">{preview.length}レース</span>
                    <span className="text-white/40 mx-1">/</span>
                    <span className="text-amber-300">{preview.reduce((s, r) => s + r.horses.length, 0)}頭</span>
                  </p>
                  {dupCount > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-orange-500/15 border border-orange-500/30 text-orange-400 rounded-full">
                      更新 {dupCount}件
                    </span>
                  )}
                  {newCount > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-green-500/15 border border-green-500/30 text-green-400 rounded-full">
                      新規 {newCount}件
                    </span>
                  )}
                </div>
                <div className="divide-y divide-white/5 max-h-56 overflow-y-auto">
                  {preview.map((race, i) => {
                    const isDup = importedRaceKeys.has(`${race.raceDate}__${race.racecourse}__${race.raceNumber}`)
                    return (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/3">
                        <div className="flex items-center gap-2 text-xs min-w-0 flex-wrap">
                          <span className="text-white/40 shrink-0">{race.raceDate}</span>
                          <span className="text-white font-bold shrink-0">{race.racecourse} {race.raceNumber}R</span>
                          <span className="text-white/70 truncate">{race.raceName}</span>
                          <span className={`shrink-0 ${SURFACE_COLOR[race.surface] ?? 'text-white/50'}`}>
                            {race.surface}{race.distance}m
                          </span>
                          <span className="text-white/40 shrink-0">{race.trackCondition}</span>
                          {isDup && (
                            <span className="shrink-0 px-1.5 py-0.5 bg-orange-500/15 border border-orange-500/30 text-orange-400 rounded text-xs">
                              上書き更新
                            </span>
                          )}
                        </div>
                        <span className="text-amber-300 text-xs shrink-0 ml-4">{race.horses.length}頭</span>
                      </div>
                    )
                  })}
                </div>
                {/* Per-row validation issues */}
                {previewIssues.length > 0 && (() => {
                  const errorCount = previewIssues.filter(x => x.level === 'error').length
                  const warnCount = previewIssues.filter(x => x.level === 'warn').length
                  const hasBlockingErrors = errorCount > 0
                  return (
                    <details className="border-t border-white/10">
                      <summary className={`px-4 py-2.5 text-xs cursor-pointer flex items-center gap-2 hover:bg-white/3 transition-colors ${hasBlockingErrors ? 'text-red-400' : 'text-yellow-400/80'}`}>
                        <span>{hasBlockingErrors ? '✕' : '⚠'}</span>
                        <span>
                          {errorCount > 0 && `エラー ${errorCount}件`}
                          {errorCount > 0 && warnCount > 0 && ' / '}
                          {warnCount > 0 && `自動補正 ${warnCount}件`}
                          （クリックで詳細）
                        </span>
                      </summary>
                      <div className="px-4 pb-3 space-y-1 max-h-40 overflow-y-auto">
                        {previewIssues.slice(0, 30).map((issue, i) => (
                          <div key={i} className={`text-xs flex items-start gap-2 ${issue.level === 'error' ? 'text-red-400/80' : 'text-yellow-400/60'}`}>
                            <span className="shrink-0 font-mono">{issue.level === 'error' ? '✕' : '→'} {issue.row}行</span>
                            <span className="text-white/35 shrink-0">[{issue.field}]</span>
                            <span>{issue.msg}</span>
                          </div>
                        ))}
                        {previewIssues.length > 30 && (
                          <p className="text-white/25 text-xs">他 {previewIssues.length - 30}件…</p>
                        )}
                      </div>
                    </details>
                  )
                })()}

                <div className="px-4 py-3 border-t border-white/10">
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {importing ? '取込中...' : `${preview.length}レースをインポートする`}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* Import result */}
        {importResult && (
          <div className={`mt-4 border rounded-xl p-4 text-sm ${
            importResult.ok
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <span className="whitespace-pre-wrap">{importResult.message}</span>
              {importResult.ok && (
                <Link href="/" className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors">
                  ホームでAI分析を確認 →
                </Link>
              )}
            </div>
            {importResult.warnings && importResult.warnings.length > 0 && (
              <details className="mt-3">
                <summary className="text-yellow-400/70 text-xs cursor-pointer hover:text-yellow-400">
                  自動補正 {importResult.warnings.length}件（クリックで詳細）
                </summary>
                <ul className="mt-2 space-y-1">
                  {importResult.warnings.map((w, i) => (
                    <li key={i} className="text-yellow-400/60 text-xs">{w}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      {/* Imported data list */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-amber-400 font-bold text-lg">取込済みデータ</h2>
          {importedRaces.length > 0 && (
            <button
              onClick={handleClear}
              disabled={clearing}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              {clearing ? '削除中...' : 'すべて削除（モックに戻す）'}
            </button>
          )}
        </div>

        {importedRaces.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            <select
              value={filterVenue}
              onChange={e => setFilterVenue(e.target.value)}
              className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-amber-500/50 transition-colors"
            >
              <option value="">全競馬場</option>
              {uniqueVenues.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <div className="flex items-center gap-1">
              {(['', '芝', 'ダート'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterSurface(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterSurface === s
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-white/5 text-white/50 border border-white/15 hover:text-white/70'
                  }`}
                >
                  {s || '全て'}
                </button>
              ))}
            </div>
            {hasFilters && (
              <>
                <button
                  onClick={() => { setFilterDate(''); setFilterVenue(''); setFilterSurface('') }}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors px-2 py-1.5"
                >
                  ✕ クリア
                </button>
                <span className="text-xs text-white/35">{filteredRaces.length} / {importedRaces.length}件</span>
              </>
            )}
          </div>
        )}

        {loadingList ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-2">
            {[1, 2].map(i => <div key={i} className="h-4 bg-white/10 rounded animate-pulse" />)}
          </div>
        ) : importedRaces.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
            <p className="text-white/40 text-sm">取込済みデータはありません</p>
            <p className="text-white/25 text-xs mt-1.5">
              CSVをインポートすると、ホーム画面でモックデータの代わりにCSVデータが表示されます
            </p>
          </div>
        ) : filteredRaces.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
            <p className="text-white/40 text-sm">フィルター条件に一致するレースがありません</p>
          </div>
        ) : (
          <>
            <p className="text-white/35 text-xs mb-3">
              {hasFilters
                ? `${filteredRaces.length}件表示（全${importedRaces.length}レース中）`
                : `${importedRaces.length}レース取込済 — ホーム画面ではこのデータが優先表示されています`
              }
            </p>
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left px-4 py-2.5 text-white/40 text-xs font-medium border-b border-white/10 whitespace-nowrap">開催日</th>
                      <th className="text-left px-4 py-2.5 text-white/40 text-xs font-medium border-b border-white/10 whitespace-nowrap">競馬場・R</th>
                      <th className="text-left px-4 py-2.5 text-white/40 text-xs font-medium border-b border-white/10 whitespace-nowrap">レース名</th>
                      <th className="text-left px-4 py-2.5 text-white/40 text-xs font-medium border-b border-white/10 whitespace-nowrap">条件</th>
                      <th className="text-left px-4 py-2.5 text-white/40 text-xs font-medium border-b border-white/10 whitespace-nowrap">頭数</th>
                      <th className="text-left px-4 py-2.5 text-white/40 text-xs font-medium border-b border-white/10 whitespace-nowrap w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRaces.map(race => (
                      <tr key={race.id} className="border-t border-white/5 hover:bg-white/4 transition-colors group">
                        <td className="px-4 py-2.5 text-white/55 text-xs whitespace-nowrap">{race.raceDate}</td>
                        <td className="px-4 py-2.5 text-white font-bold text-xs whitespace-nowrap">{race.racecourse} {race.raceNumber}R</td>
                        <td className="px-4 py-2.5 text-white/75 text-xs">{race.raceName}</td>
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                          <span className={SURFACE_COLOR[race.surface] ?? 'text-white/50'}>{race.surface}</span>
                          <span className="text-white/40 mx-1">{race.distance}m</span>
                          <span className="text-white/40">{race.trackCondition}</span>
                        </td>
                        <td className="px-4 py-2.5 text-amber-300 text-xs whitespace-nowrap">{race._count.horses}頭</td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            onClick={() => handleDeleteRace(race.id, `${race.racecourse} ${race.raceNumber}R ${race.raceName}`)}
                            disabled={deletingId === race.id}
                            className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-red-400 text-sm transition-all disabled:opacity-50"
                            title="このレースを削除"
                          >
                            {deletingId === race.id ? '…' : '✕'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
