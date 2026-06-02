import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

export type Decision = 'KEEP' | 'HOLD' | 'ELIMINATE'

export interface LocalHorse {
  horseNumber: number
  horseName: string
  popularity: number
  winOdds: number
  jockeyName: string
  runningStyle: string
}

export interface HorseAnalysis {
  horseNumber: number
  horseName: string
  aiScore: number
  survivalScore: number
  decision: Decision
  reasons: string[]
  valueComment: string
}

export interface BetSuggestion {
  betType: string
  horses: string[]
  reason: string
}

export interface RaceAnalysis {
  horses: HorseAnalysis[]
  honmei: string[]
  anaume: string[]
  kiken: string[]
  kaime: BetSuggestion[]
  miokuri: boolean
  overallComment: string
  analyzedAt: string
}

export interface RaceResult {
  isHit: boolean
  stake: number
  payout: number
  profit: number
  memo: string
  recordedAt: string
}

export interface LocalRace {
  id: string
  raceDate: string
  venue: string
  raceNumber: number
  raceName: string
  distance: number
  surface: string
  trackCondition: string
  horses: LocalHorse[]
  analysis?: RaceAnalysis
  result?: RaceResult
  createdAt: string
}

const DATA_FILE = path.join(process.cwd(), 'data', 'races.json')

function ensureFile() {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(DATA_FILE))
    fs.writeFileSync(DATA_FILE, JSON.stringify({ races: [] }, null, 2), 'utf-8')
}

export function readRaces(): LocalRace[] {
  ensureFile()
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(raw).races ?? []
  } catch {
    return []
  }
}

export function writeRaces(races: LocalRace[]): void {
  ensureFile()
  fs.writeFileSync(DATA_FILE, JSON.stringify({ races }, null, 2), 'utf-8')
}

export function getRace(id: string): LocalRace | undefined {
  return readRaces().find(r => r.id === id)
}

export function saveRace(race: LocalRace): LocalRace {
  const races = readRaces()
  const idx = races.findIndex(r => r.id === race.id)
  if (idx >= 0) races[idx] = race
  else races.unshift(race)
  writeRaces(races)
  return race
}

export function updateRace(id: string, update: Partial<LocalRace>): LocalRace | null {
  const races = readRaces()
  const idx = races.findIndex(r => r.id === id)
  if (idx < 0) return null
  races[idx] = { ...races[idx], ...update }
  writeRaces(races)
  return races[idx]
}

export function createRace(data: Omit<LocalRace, 'id' | 'createdAt'>): LocalRace {
  const race: LocalRace = { ...data, id: randomUUID(), createdAt: new Date().toISOString() }
  saveRace(race)
  return race
}
