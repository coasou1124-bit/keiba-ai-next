#!/usr/bin/env node
/**
 * CSV自動取り込みウォッチャー
 *
 * 使い方:
 *   npm run watch:import          # localhost:3000 を対象
 *   IMPORT_URL=http://... npm run watch:import  # カスタムURL
 *
 * watch-import/ に .csv を置くと自動で /api/import に POST します。
 *   成功 → imported/ へ移動
 *   失敗 → error/    へ移動
 */

import chokidar from 'chokidar'
import { readFileSync, mkdirSync, renameSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')

const WATCH_DIR    = join(ROOT, 'watch-import')
const IMPORTED_DIR = join(ROOT, 'imported')
const ERROR_DIR    = join(ROOT, 'error')
const API_URL      = process.env.IMPORT_URL ?? 'http://localhost:3000/api/import'

// 初回起動時にフォルダを自動作成
for (const dir of [WATCH_DIR, IMPORTED_DIR, ERROR_DIR]) {
  mkdirSync(dir, { recursive: true })
}

// ---- ユーティリティ ----

function now() {
  return new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
}

function log(msg) {
  console.log(`[${now()}] ${msg}`)
}

/** 移動先パス: <dir>/2025-01-23T12-34-56_filename.csv */
function destPath(dir, filename) {
  const prefix = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  return join(dir, `${prefix}_${filename}`)
}

/** ファイルを安全に移動（同名ファイルが既にある場合は上書き） */
function moveFile(src, dest) {
  try {
    renameSync(src, dest)
  } catch {
    // renameSync が cross-device で失敗した場合のフォールバックは不要
    // (同一ドライブ内のため通常発生しない)
    throw new Error(`ファイル移動失敗: ${src} → ${dest}`)
  }
}

// ---- メイン処理 ----

/** 処理中ファイルの重複実行を防ぐセット */
const processing = new Set()

async function processFile(filePath) {
  if (processing.has(filePath)) return
  processing.add(filePath)

  const filename = basename(filePath)
  log(`📂 検知: ${filename}`)

  // ファイル読み込み
  let csv
  try {
    csv = readFileSync(filePath, 'utf-8')
  } catch (e) {
    log(`❌ 読み込みエラー: ${filename} — ${e.message}`)
    moveFile(filePath, destPath(ERROR_DIR, filename))
    processing.delete(filePath)
    return
  }

  // /api/import へ POST
  let res, data
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv, fileName: filename }),
    })
    data = await res.json()
  } catch (e) {
    log(`❌ APIエラー: ${filename} — ${e.message}`)
    log(`   → Next.js が起動しているか確認してください (${API_URL})`)
    moveFile(filePath, destPath(ERROR_DIR, filename))
    processing.delete(filePath)
    return
  }

  // レスポンス判定
  if (res.status === 409) {
    // 重複インポート: エラーではなく imported へ移動
    log(`⚠️  重複スキップ: ${filename}`)
    log(`   → ${data.error}`)
    moveFile(filePath, destPath(IMPORTED_DIR, filename))
    processing.delete(filePath)
    return
  }

  if (!res.ok) {
    log(`❌ インポート失敗 [${res.status}]: ${filename}`)
    log(`   → ${data.error ?? 'Unknown error'}`)
    moveFile(filePath, destPath(ERROR_DIR, filename))
    processing.delete(filePath)
    return
  }

  // 成功
  log(`✅ インポート完了: ${filename}`)
  log(`   → ${data.message}`)
  if (data.statsUpdated !== undefined) {
    log(`   📊 LearningStat 再計算: ${data.statsUpdated} セグメント`)
  }
  if (data.warnings?.length) {
    log(`   ⚡ 自動補正: ${data.warnings.length} 件`)
  }

  moveFile(filePath, destPath(IMPORTED_DIR, filename))
  processing.delete(filePath)
}

// ---- ウォッチャー起動 ----

log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
log('🔍 CSV自動取り込みウォッチャー 起動')
log(`   監視フォルダ: ${WATCH_DIR}`)
log(`   API:          ${API_URL}`)
log(`   成功移動先:   ${IMPORTED_DIR}`)
log(`   失敗移動先:   ${ERROR_DIR}`)
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

const watcher = chokidar.watch(WATCH_DIR, {
  ignored: /(^|[/\\])\../,  // 隠しファイル無視
  persistent: true,
  depth: 0,                  // サブフォルダを監視しない
  awaitWriteFinish: {        // ファイル書き込み完了を待つ（大容量CSV対応）
    stabilityThreshold: 1500,
    pollInterval: 300,
  },
})

watcher.on('add', (filePath) => {
  if (!filePath.toLowerCase().endsWith('.csv')) return
  if (!existsSync(filePath)) return  // 既に移動済みの場合スキップ
  processFile(filePath)
})

watcher.on('error', (err) => {
  log(`⚠️  ウォッチャーエラー: ${err.message}`)
})

process.on('SIGINT', () => {
  log('')
  log('🛑 ウォッチャー終了 (Ctrl+C)')
  watcher.close().then(() => process.exit(0))
})
