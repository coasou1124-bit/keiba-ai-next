import { prisma } from './prisma'
import { popularityRangeLabel, aiScoreRangeLabel } from './learningSegments'

const MIN_SAMPLES = 5

type Acc = { stake: number; payout: number; wins: number; count: number }
type SegKey = {
  venue: string
  surface: string
  distance: number
  betType: string
  popularityRange: string
  aiScoreRange: string
}

function toKeyStr(k: SegKey): string {
  return [k.venue, k.surface, k.distance, k.betType, k.popularityRange, k.aiScoreRange].join('|')
}

/**
 * Bet テーブルの決済済みデータから LearningStat を全件再計算する。
 * セグメント：venue / surface / betType / popularityRange / aiScoreRange の単独軸 + venue×surface 複合。
 * MIN_SAMPLES 未満のセグメントは除外。
 * 既存レコードを削除してから一括 insert（トランザクション）。
 */
export async function recalcLearningStats(): Promise<number> {
  const bets = await prisma.bet.findMany({
    where: { isHit: { not: null } },
    select: {
      venue: true, surface: true, betType: true,
      popularity: true, aiScore: true,
      stake: true, payout: true, isHit: true,
    },
  })

  const map = new Map<string, { key: SegKey; acc: Acc }>()

  function add(key: SegKey, stake: number, payout: number, isHit: boolean) {
    const k = toKeyStr(key)
    const cur = map.get(k)
    if (cur) {
      cur.acc.stake += stake
      cur.acc.payout += payout
      cur.acc.wins += isHit ? 1 : 0
      cur.acc.count += 1
    } else {
      map.set(k, { key, acc: { stake, payout, wins: isHit ? 1 : 0, count: 1 } })
    }
  }

  for (const b of bets) {
    const isHit = b.isHit === true
    const pr  = popularityRangeLabel(b.popularity)
    const asr = aiScoreRangeLabel(b.aiScore)
    const v   = b.venue   || ''
    const s   = b.surface || ''
    const bt  = b.betType || ''

    if (v)  add({ venue: v, surface: '', distance: 0, betType: '',  popularityRange: '',  aiScoreRange: ''  }, b.stake, b.payout, isHit)
    if (s)  add({ venue: '', surface: s, distance: 0, betType: '',  popularityRange: '',  aiScoreRange: ''  }, b.stake, b.payout, isHit)
    if (bt) add({ venue: '', surface: '', distance: 0, betType: bt, popularityRange: '',  aiScoreRange: ''  }, b.stake, b.payout, isHit)
    if (pr) add({ venue: '', surface: '', distance: 0, betType: '',  popularityRange: pr, aiScoreRange: ''  }, b.stake, b.payout, isHit)
            add({ venue: '', surface: '', distance: 0, betType: '',  popularityRange: '',  aiScoreRange: asr }, b.stake, b.payout, isHit)
    if (v && s) add({ venue: v, surface: s, distance: 0, betType: '', popularityRange: '', aiScoreRange: '' }, b.stake, b.payout, isHit)
  }

  const records = Array.from(map.values())
    .filter(({ acc }) => acc.count >= MIN_SAMPLES)
    .map(({ key, acc }) => {
      const winRate = Math.round((acc.wins / acc.count) * 100)
      const roi     = acc.stake > 0 ? Math.round((acc.payout / acc.stake) * 100) : 0
      const returnRateBonus = acc.stake > 0
        ? Math.max(-10, Math.min(10, Math.round(((acc.payout / acc.stake) - 1) * 10)))
        : 0
      return { ...key, winRate, roi, returnRateBonus, sampleCount: acc.count }
    })

  await prisma.$transaction(async (tx) => {
    await tx.learningStat.deleteMany()
    if (records.length > 0) {
      await tx.learningStat.createMany({ data: records })
    }
  })

  return records.length
}
