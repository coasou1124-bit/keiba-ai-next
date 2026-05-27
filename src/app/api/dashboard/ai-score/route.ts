export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export interface AiScoreGroup {
  label: string
  rangeLabel: string        // LearningStat.aiScoreRange と一致するキー ('80-100' 等)
  range: [number, number]
  count: number
  winCount: number
  winRate: number
  totalStake: number
  totalPayout: number
  returnRate: number
  profit: number
  bonus: number             // LearningStat.returnRateBonus (±10, 5件未満は 0)
  sampleCount: number       // LearningStat.sampleCount
}

// グループ定義 — rangeLabel は learningSegments.ts の aiScoreRangeLabel() 出力と一致させること
const GROUPS: { label: string; rangeLabel: string; range: [number, number] }[] = [
  { label: '高スコア (80〜100)',  rangeLabel: '80-100', range: [80, 100] },
  { label: '中スコア (60〜79)',   rangeLabel: '60-79',  range: [60, 79]  },
  { label: '中低スコア (40〜59)', rangeLabel: '40-59',  range: [40, 59]  },
  { label: '低スコア (0〜39)',    rangeLabel: '0-39',   range: [0,  39]  },
]

// GET /api/dashboard/ai-score
// AIスコア帯別の回収率集計 + LearningStat からの補正値を返す
export async function GET() {
  try {
    const [bets, learningStats] = await Promise.all([
      prisma.bet.findMany({
        where: { isHit: { not: null } },
        select: { aiScore: true, stake: true, payout: true, isHit: true },
      }),
      // aiScoreRange 単独軸のレコードだけ取得（venue/surface/betType/popularityRange はすべて空）
      prisma.learningStat.findMany({
        where: {
          aiScoreRange:    { not: '' },
          venue:           '',
          surface:         '',
          betType:         '',
          popularityRange: '',
        },
        select: { aiScoreRange: true, returnRateBonus: true, sampleCount: true },
      }),
    ])

    const groups: AiScoreGroup[] = GROUPS.map(({ label, rangeLabel, range: [min, max] }) => {
      const subset = bets.filter(b => b.aiScore >= min && b.aiScore <= max)
      const winCount    = subset.filter(b => b.isHit === true).length
      const totalStake  = subset.reduce((s, b) => s + b.stake,  0)
      const totalPayout = subset.reduce((s, b) => s + b.payout, 0)
      const count       = subset.length

      const stat = learningStats.find(s => s.aiScoreRange === rangeLabel)

      return {
        label,
        rangeLabel,
        range:       [min, max],
        count,
        winCount,
        winRate:     count > 0 ? Math.round((winCount / count) * 1000) / 10 : 0,
        totalStake,
        totalPayout,
        returnRate:  totalStake > 0 ? Math.round((totalPayout / totalStake) * 1000) / 10 : 0,
        profit:      totalPayout - totalStake,
        bonus:       stat ? stat.returnRateBonus : 0,
        sampleCount: stat ? stat.sampleCount     : 0,
      }
    })

    return NextResponse.json({ groups })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
