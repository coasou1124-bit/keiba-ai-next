import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recalcLearningStats } from '@/lib/learningStats'
import {
  normalizeDate, normalizeRacecourse, normalizeSurface, normalizeTrackCondition,
  normalizeRunningStyle, normalizeWeather, normalizeOdds, normalizeInt,
  normalizeFloat, normalizeHorseName, normalizeGrade, toHalfWidth,
} from '@/lib/csvNormalize'

// ---- CSV Parser (handles quoted fields containing commas) ----
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
  if (lines.length < 2) throw new Error('CSVにデータがありません（ヘッダー行 + 1行以上必要）')

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim())
  const required = ['raceDate', 'racecourse', 'raceNumber', 'horseName']
  const missing = required.filter(f => !headers.includes(f))
  if (missing.length > 0) throw new Error(`必須カラムが不足: ${missing.join(', ')}`)

  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i]?.replace(/^"|"$/g, '') ?? '' })
    return row
  })
}

// ---- Row-level validation ----
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type RowIssue = { row: number; level: 'error' | 'warn'; field: string; msg: string }

function validateAndNormalizeRows(rows: Record<string, string>[]): {
  errors: string[]
  warnings: string[]
  issues: RowIssue[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  const issues: RowIssue[] = []

  rows.forEach((row, i) => {
    const line = i + 2

    // 馬名
    const rawName = row.horseName?.trim() ?? ''
    if (!rawName) {
      errors.push(`${line}行目: 馬名が空です`)
      issues.push({ row: line, level: 'error', field: 'horseName', msg: '馬名が空欄' })
    }

    // 開催日
    const rawDate = row.raceDate?.trim() ?? ''
    if (!rawDate) {
      errors.push(`${line}行目: 開催日が空です`)
      issues.push({ row: line, level: 'error', field: 'raceDate', msg: '開催日が空欄' })
    } else {
      const normalized = normalizeDate(rawDate)
      if (!DATE_RE.test(normalized)) {
        errors.push(`${line}行目: 日付形式エラー（正規化後: "${normalized}"）: "${rawDate}"`)
        issues.push({ row: line, level: 'error', field: 'raceDate', msg: `日付形式エラー: "${rawDate}"` })
      } else if (normalized !== rawDate) {
        warnings.push(`${line}行目: 開催日を正規化 "${rawDate}" → "${normalized}"`)
        issues.push({ row: line, level: 'warn', field: 'raceDate', msg: `"${rawDate}" → "${normalized}"` })
      }
    }

    // 競馬場
    if (!row.racecourse?.trim()) {
      errors.push(`${line}行目: 競馬場名が空です`)
      issues.push({ row: line, level: 'error', field: 'racecourse', msg: '競馬場が空欄' })
    }

    // オッズ
    if (row.odds?.trim()) {
      const v = normalizeOdds(row.odds)
      if (v <= 0) {
        warnings.push(`${line}行目: オッズ無効（0に補正）: "${row.odds}"`)
        issues.push({ row: line, level: 'warn', field: 'odds', msg: `オッズ無効: "${row.odds}"` })
      } else if (v.toString() !== row.odds.trim()) {
        const rawStr = row.odds.trim()
        if (rawStr !== v.toString()) {
          issues.push({ row: line, level: 'warn', field: 'odds', msg: `オッズ正規化: "${rawStr}" → ${v}` })
        }
      }
    }

    // 馬場種別
    if (row.surface?.trim()) {
      const norm = normalizeSurface(row.surface)
      if (!['芝', 'ダート', '障害'].includes(norm)) {
        warnings.push(`${line}行目: 馬場「${row.surface}」未認識 → 芝に補正`)
        issues.push({ row: line, level: 'warn', field: 'surface', msg: `"${row.surface}" → 芝` })
      } else if (norm !== row.surface.trim()) {
        issues.push({ row: line, level: 'warn', field: 'surface', msg: `"${row.surface}" → "${norm}"` })
      }
    }

    // 馬場状態
    if (row.trackCondition?.trim()) {
      const norm = normalizeTrackCondition(row.trackCondition)
      if (norm !== row.trackCondition.trim()) {
        issues.push({ row: line, level: 'warn', field: 'trackCondition', msg: `"${row.trackCondition}" → "${norm}"` })
      }
    }

    // 脚質
    if (row.runningStyle?.trim()) {
      const norm = normalizeRunningStyle(row.runningStyle)
      if (!norm) {
        warnings.push(`${line}行目: 脚質「${row.runningStyle}」未認識 → 空欄`)
        issues.push({ row: line, level: 'warn', field: 'runningStyle', msg: `"${row.runningStyle}" 未認識` })
      }
    }
  })

  return { errors, warnings, issues }
}

// ---- Race grouping ----
type RaceGroup = {
  raceDate: string
  racecourse: string
  raceNumber: number
  raceName: string
  surface: string
  distance: number
  weather: string
  trackCondition: string
  raceGrade: string
  horses: {
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
  }[]
}

function groupByRace(rows: Record<string, string>[]): RaceGroup[] {
  const map = new Map<string, RaceGroup>()
  for (const row of rows) {
    const raceDate = normalizeDate(row.raceDate ?? '')
    const racecourse = normalizeRacecourse(row.racecourse ?? '')
    const raceNumber = normalizeInt(row.raceNumber ?? '', 0)
    const key = `${raceDate}__${racecourse}__${raceNumber}`

    if (!map.has(key)) {
      map.set(key, {
        raceDate,
        racecourse,
        raceNumber,
        raceName: toHalfWidth(row.raceName?.trim() ?? ''),
        surface: normalizeSurface(row.surface ?? ''),
        distance: normalizeInt(row.distance ?? '', 1600) || 1600,
        weather: normalizeWeather(row.weather ?? ''),
        trackCondition: normalizeTrackCondition(row.trackCondition ?? ''),
        raceGrade: normalizeGrade(row.raceGrade ?? ''),
        horses: [],
      })
    }

    const horseName = normalizeHorseName(row.horseName ?? '')
    if (horseName) {
      map.get(key)!.horses.push({
        horseName,
        frameNumber: normalizeInt(row.frameNumber ?? '', 1) || 1,
        horseNumber: normalizeInt(row.horseNumber ?? '', 1) || 1,
        popularity: normalizeInt(row.popularity ?? '', 0),
        odds: normalizeOdds(row.odds ?? '') || 1.0,
        runningStyle: normalizeRunningStyle(row.runningStyle ?? ''),
        finalPosition: normalizeInt(row.finalPosition ?? '', 0),
        jockeyName: toHalfWidth(row.jockeyName?.trim() ?? ''),
        weightCarried: normalizeFloat(row.weightCarried ?? '', 0),
        horseSex: toHalfWidth(row.horseSex?.trim() ?? ''),
        horseAge: normalizeInt(row.horseAge ?? '', 0),
      })
    }
  }
  return Array.from(map.values()).filter(r => r.horses.length > 0)
}

// GET: list all imported races + global stats
export async function GET() {
  try {
    const [races, totalHorses] = await Promise.all([
      prisma.importedRace.findMany({
        include: { _count: { select: { horses: true } } },
        orderBy: [{ raceDate: 'desc' }, { raceNumber: 'asc' }],
      }),
      prisma.importedHorse.count(),
    ])
    return NextResponse.json({
      races,
      stats: { totalRaces: races.length, totalHorses },
    })
  } catch {
    return NextResponse.json({ error: 'データ取得に失敗しました' }, { status: 500 })
  }
}

// POST: import CSV
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { csv?: string; fileName?: string }
    if (!body.csv?.trim()) return NextResponse.json({ error: 'CSVデータが空です' }, { status: 400 })

    const fileName = body.fileName?.trim() || 'unknown.csv'
    const fileHash = createHash('sha256').update(body.csv).digest('hex')

    // 二重インポート防止チェック（成功済みのみ対象）
    const dup = await prisma.importHistory.findFirst({ where: { fileHash, success: true } })
    if (dup) {
      const dt = new Date(dup.importedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
      return NextResponse.json(
        { error: `このファイルは既にインポート済みです（${dt}）` },
        { status: 409 }
      )
    }

    let rows: Record<string, string>[]
    try {
      rows = parseCSV(body.csv)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'CSV解析エラー'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const { errors, warnings, issues } = validateAndNormalizeRows(rows)

    if (errors.length > 0) {
      const shown = errors.slice(0, 5)
      const extra = errors.length > 5 ? ` 他${errors.length - 5}件` : ''
      return NextResponse.json(
        {
          error: `入力エラー（${errors.length}件）:\n${shown.join('\n')}${extra}`,
          issues: issues.filter(x => x.level === 'error').slice(0, 20),
        },
        { status: 400 }
      )
    }

    const raceGroups = groupByRace(rows)
    if (raceGroups.length === 0)
      return NextResponse.json({ error: '有効なレースデータが見つかりません' }, { status: 400 })

    const existing = await prisma.importedRace.findMany({
      where: {
        OR: raceGroups.map(g => ({
          raceDate: g.raceDate,
          racecourse: g.racecourse,
          raceNumber: g.raceNumber,
        })),
      },
      select: { raceDate: true, racecourse: true, raceNumber: true },
    })
    const existingKeys = new Set(existing.map(r => `${r.raceDate}__${r.racecourse}__${r.raceNumber}`))

    let created = 0
    let updated = 0

    await prisma.$transaction(async (tx) => {
      for (const group of raceGroups) {
        const key = `${group.raceDate}__${group.racecourse}__${group.raceNumber}`
        await tx.importedRace.deleteMany({
          where: { raceDate: group.raceDate, racecourse: group.racecourse, raceNumber: group.raceNumber },
        })
        await tx.importedRace.create({
          data: {
            raceDate: group.raceDate,
            racecourse: group.racecourse,
            raceNumber: group.raceNumber,
            raceName: group.raceName,
            surface: group.surface,
            distance: group.distance,
            weather: group.weather,
            trackCondition: group.trackCondition,
            raceGrade: group.raceGrade,
            horses: { create: group.horses },
          },
        })
        if (existingKeys.has(key)) updated++
        else created++
      }
    })

    const totalHorses = raceGroups.reduce((sum, r) => sum + r.horses.length, 0)

    let message: string
    if (created > 0 && updated > 0) {
      message = `新規 ${created}レース / 更新 ${updated}レース（計${totalHorses}頭）`
    } else if (updated > 0) {
      message = `${updated}レース・${totalHorses}頭を更新しました`
    } else {
      message = `${created}レース・${totalHorses}頭を取り込みました`
    }
    if (warnings.length > 0) message += `（自動補正 ${warnings.length}件）`

    // インポート履歴を記録
    await prisma.importHistory.create({
      data: {
        fileName,
        raceDate: raceGroups[0]?.raceDate ?? '',
        count: totalHorses,
        success: true,
        fileHash,
      },
    })

    // 学習統計を自動再計算（決済済み Bet がなければ 0 件で正常終了）
    const statsUpdated = await recalcLearningStats()

    return NextResponse.json({
      success: true,
      message,
      created,
      updated,
      races: raceGroups.length,
      horses: totalHorses,
      warnings: warnings.slice(0, 10),
      issues: issues.slice(0, 30),
      statsUpdated,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'インポートに失敗しました'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE: all races, or single race by ?id=
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id')
    if (id) {
      await prisma.importedRace.delete({ where: { id } })
      return NextResponse.json({ success: true, deleted: 1 })
    }
    const result = await prisma.importedRace.deleteMany()
    return NextResponse.json({ success: true, deleted: result.count })
  } catch {
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
