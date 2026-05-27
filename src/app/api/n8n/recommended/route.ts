export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkN8nAuth, unauthorizedResponse } from '@/lib/n8nAuth'

type RaceHorse = {
  name: string
  number: number
  popularity: number
  winOdds: number
  aiScore: number
  aiRank: number
  marketLabel?: string
  aiScoreBonus?: number
  aiScoreBonusReason?: string
}

type OptBet = {
  role: string
  betType: string
  horses: string[]
  odds: number
  allocationPct: number
  reason: string
  evScore: number
  signal: 'buy' | 'pass'
}

type RaceData = {
  id: string
  date: string
  venue: string
  raceNumber: number
  raceName: string
  distance: number
  surface: string
  trackCondition: string
  overallEvScore: number
  horses: RaceHorse[]
  optimizedBets: OptBet[]
}

function signStr(n: number): string {
  return n >= 0 ? '+' : ''
}

function buildDiscordMessage(
  race: RaceData,
  honmei: RaceHorse,
  taiko: RaceHorse | null,
  buyBets: OptBet[]
): string {
  const lines: string[] = [
    `🏇 **【買い推奨】${race.venue} 第${race.raceNumber}レース**`,
    `📋 ${race.raceName}（${race.surface}${race.distance}m）`,
    '',
    `🥇 **本命**: ${honmei.name}（${honmei.popularity}番人気 ${(honmei.winOdds ?? 0).toFixed(1)}倍）AIスコア \`${signStr(honmei.aiScore)}${honmei.aiScore}\`${honmei.marketLabel ? ` ${honmei.marketLabel}` : ''}`,
  ]
  if (taiko) {
    lines.push(
      `🥈 **対抗**: ${taiko.name}（${taiko.popularity}番人気 ${(taiko.winOdds ?? 0).toFixed(1)}倍）AIスコア \`${signStr(taiko.aiScore)}${taiko.aiScore}\``
    )
  }
  lines.push('', '💰 **推奨馬券**:')
  buyBets.forEach((bet, i) => {
    const pfx = i === buyBets.length - 1 ? '└' : '├'
    lines.push(
      `  ${pfx} ${bet.betType}: ${bet.horses.join('+')} × ${bet.allocationPct}%  EV\`${signStr(bet.evScore)}${bet.evScore}\``
    )
  })
  lines.push('', `📊 レース総合EV: \`${signStr(race.overallEvScore)}${race.overallEvScore}\``)
  if (buyBets[0]?.reason) lines.push(`💡 ${buyBets[0].reason}`)
  return lines.join('\n')
}

function buildLineMessage(
  race: RaceData,
  honmei: RaceHorse,
  taiko: RaceHorse | null,
  buyBets: OptBet[]
): string {
  const bets = buyBets
    .slice(0, 3)
    .map(b => `${b.betType}${b.horses.join('-')}(EV${signStr(b.evScore)}${b.evScore})`)
    .join(' / ')
  const lines = [
    `【推奨】${race.venue}${race.raceNumber}R ${race.raceName}(${race.surface}${race.distance}m)`,
    `本命:${honmei.name}(${honmei.popularity}人気 ${(honmei.winOdds ?? 0).toFixed(1)}倍)AI${signStr(honmei.aiScore)}${honmei.aiScore}`,
  ]
  if (taiko) {
    lines.push(`対抗:${taiko.name}(${taiko.popularity}人気)AI${signStr(taiko.aiScore)}${taiko.aiScore}`)
  }
  lines.push(`推奨:${bets}`)
  const evPart = `EV${signStr(race.overallEvScore)}${race.overallEvScore}`
  const reasonPart = buyBets[0]?.reason ? ` ${buyBets[0].reason}` : ''
  lines.push(`${evPart}${reasonPart}`.trim())
  return lines.join('\n')
}

export async function GET(req: NextRequest) {
  if (!checkN8nAuth(req)) return unauthorizedResponse()

  try {
    const { searchParams, origin } = new URL(req.url)
    const minEv = Number(searchParams.get('minEv') ?? 20)
    const minAiScore = Number(searchParams.get('minAiScore') ?? 30)
    const minBetEv = Number(searchParams.get('minBetEv') ?? 20)

    const res = await fetch(`${origin}/api/races`)
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch races' }, { status: 502 })
    const { races } = (await res.json()) as { races: RaceData[] }

    const recommended = races
      .filter(race => {
        if (race.overallEvScore < minEv) return false
        if (!race.horses || race.horses.length === 0) return false
        const topHorse = [...race.horses].sort((a, b) => b.aiScore - a.aiScore)[0]
        if (topHorse.aiScore < minAiScore) return false
        const mainBuyBet = (race.optimizedBets ?? []).find(b => b.signal === 'buy')
        if (!mainBuyBet || mainBuyBet.evScore < minBetEv) return false
        return true
      })
      .map(race => {
        const sortedByAi = [...race.horses].sort((a, b) => b.aiScore - a.aiScore)
        const honmei = sortedByAi[0]
        const taiko = sortedByAi[1] ?? null
        const buyBets = (race.optimizedBets ?? []).filter(b => b.signal === 'buy')

        return {
          raceId: race.id,
          raceName: race.raceName,
          date: race.date,
          venue: race.venue,
          raceNumber: race.raceNumber,
          distance: race.distance,
          surface: race.surface,
          trackCondition: race.trackCondition,
          overallEvScore: race.overallEvScore,
          honmei: {
            name: honmei.name,
            popularity: honmei.popularity,
            winOdds: honmei.winOdds ?? 0,
            aiScore: honmei.aiScore,
            marketLabel: honmei.marketLabel ?? '',
            aiScoreBonus: honmei.aiScoreBonus ?? 0,
            aiScoreBonusReason: honmei.aiScoreBonusReason ?? '',
          },
          taiko: taiko
            ? {
                name: taiko.name,
                popularity: taiko.popularity,
                winOdds: taiko.winOdds ?? 0,
                aiScore: taiko.aiScore,
                marketLabel: taiko.marketLabel ?? '',
              }
            : null,
          bets: buyBets,
          discordMessage: buildDiscordMessage(race, honmei, taiko, buyBets),
          lineMessage: buildLineMessage(race, honmei, taiko, buyBets),
        }
      })

    return NextResponse.json({
      recommendedCount: recommended.length,
      generatedAt: new Date().toISOString(),
      criteria: { minEv, minAiScore, minBetEv },
      races: recommended,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
