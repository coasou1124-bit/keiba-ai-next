import { Surface, RunningStyle, TrackCondition, TrackConditionResult } from '@/types'

const TURF_BONUSES: Record<TrackCondition, Record<RunningStyle, number>> = {
  '良':   { '逃げ':  0, '先行':  0, '差し':  0, '追込':  0 },
  '稍重': { '逃げ':  2, '先行':  3, '差し': -2, '追込': -4 },
  '重':   { '逃げ':  5, '先行':  4, '差し': -4, '追込': -6 },
  '不良': { '逃げ':  8, '先行':  6, '差し': -6, '追込': -8 },
}

const DIRT_BONUSES: Record<TrackCondition, Record<RunningStyle, number>> = {
  '良':   { '逃げ':  0, '先行':  0, '差し':  0, '追込':  0 },
  '稍重': { '逃げ':  2, '先行':  3, '差し':  0, '追込': -2 },
  '重':   { '逃げ': -4, '先行': -2, '差し':  4, '追込':  3 },
  '不良': { '逃げ': -6, '先行': -4, '差し':  6, '追込':  5 },
}

const TURF_NOTES: Record<TrackCondition, string> = {
  '良':   '良馬場：コース本来の特性が発揮される標準状態。コース・展開補正が主役。',
  '稍重': '稍重：芝に水分を含み先行馬が粘りやすくなる。差し・追込にはやや逆風。',
  '重':   '重：馬場が重く先行有利が顕著に。差しは末脚が殺されやすい消耗戦傾向。',
  '不良': '不良：極悪馬場。パワー型の逃げ・先行が圧倒的有利。差し・追込はほぼ届かない。',
}

const DIRT_NOTES: Record<TrackCondition, string> = {
  '良':   '良馬場（ダート）：砂が固くスピード型の逃げ・先行が有利な標準状態。',
  '稍重': '稍重（ダート）：湿りが入り砂が締まりスピードが出やすい。先行馬に有利。',
  '重':   '重（ダート）：砂が重くなりパワー型有利。差し・追込が台頭する展開に変わりやすい。',
  '不良': '不良（ダート）：泥濘状態。パワーとスタミナが全てを左右。差し・追込の大逆転が起きやすい。',
}

export function calcTrackConditionEvBonus(
  horseStyle: RunningStyle,
  condition: TrackCondition,
  surface: Surface
): number {
  const table = surface === '芝' ? TURF_BONUSES : DIRT_BONUSES
  return table[condition][horseStyle]
}

export function buildTrackConditionResult(
  condition: TrackCondition,
  surface: Surface
): TrackConditionResult {
  const bonusTable = surface === '芝' ? TURF_BONUSES[condition] : DIRT_BONUSES[condition]
  const styles: RunningStyle[] = ['逃げ', '先行', '差し', '追込']

  return {
    condition,
    favoredStyles: styles.filter(s => bonusTable[s] > 0),
    penalizedStyles: styles.filter(s => bonusTable[s] < 0),
    evBonus: bonusTable,
    conditionNote: surface === '芝' ? TURF_NOTES[condition] : DIRT_NOTES[condition],
  }
}
