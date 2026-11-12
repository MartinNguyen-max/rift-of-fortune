import type { Role } from '../../data/types'
import { ROLES } from '../roles'
import { formatGameTime, type CommentaryLine, type MatchLines } from './commentary'
import { SIDES, type ChampionRef, type ChampionStats, type EventTag, type KDA, type MatchEvent, type MatchResult, type MatchTeams, type Side } from './types'

export interface MatchMvp {
  side: Side
  role: Role
  kda: KDA
}

export interface MatchSummary {
  winner: Side
  mvp: MatchMvp
  /** The champion who died the most, on either team, or null when nobody died. */
  feeder: ChampionRef | null
  /** Index of the most dramatic event, or null when nothing stood out. */
  momentIndex: number | null
  /** The best line of the match: a draft roast if there was one, otherwise the moment's line. */
  bestLine: CommentaryLine | null
}

const DRAMA: Partial<Record<EventTag, number>> = {
  pentakill: 10,
  steal: 7,
  ace: 6,
  soul: 4,
  upset: 2,
  firstBlood: 2,
  counterGank: 2,
  escape: 1,
}

const KIND_DRAMA: Partial<Record<MatchEvent['kind'], number>> = { baron: 4, elder: 5, teamfight: 1 }

/** How memorable an event is: steals and pentakills beat a plain tower. */
export function dramaScore(event: MatchEvent, winner: Side): number {
  if (event.kind === 'nexus' || event.kind === 'surrender') return 0
  const tags = event.tags.reduce((sum, tag) => sum + (DRAMA[tag] ?? 0), 0)
  return tags + (KIND_DRAMA[event.kind] ?? 0) + (event.side === winner ? 1 : 0)
}

/** Kills and assists count for, deaths against. Only the winning team can be MVP. */
export function findMvp(match: MatchResult): MatchMvp {
  const stats = match.stats[match.winner]
  const value = ({ kills, deaths, assists }: KDA) => kills * 3 + assists * 1.5 - deaths * 1.5
  const role = ROLES.reduce((best, current) => (value(stats[current]) > value(stats[best]) ? current : best))
  return { side: match.winner, role, kda: stats[role] }
}

/** Who died the most. Ties go to the first champion in role order, blue side first. */
export function mostDeaths(stats: ChampionStats): ChampionRef | null {
  let worst: ChampionRef | null = null
  let deaths = 0
  for (const side of SIDES) {
    for (const role of ROLES) {
      if (stats[side][role].deaths > deaths) {
        worst = { side, role }
        deaths = stats[side][role].deaths
      }
    }
  }
  return worst
}

export function momentOfTheMatch(match: MatchResult): number | null {
  let best: number | null = null
  let bestScore = 0
  for (const [index, event] of match.events.entries()) {
    const score = dramaScore(event, match.winner)
    if (score >= bestScore && score > 0) {
      best = index
      bestScore = score
    }
  }
  return best
}

export function summarizeMatch(match: MatchResult, lines: MatchLines): MatchSummary {
  const momentIndex = momentOfTheMatch(match)
  const roast = lines.find((line) => line?.callback)
  return {
    winner: match.winner,
    mvp: findMvp(match),
    feeder: mostDeaths(match.stats),
    momentIndex,
    bestLine: roast ?? (momentIndex === null ? null : (lines[momentIndex] ?? null)),
  }
}

export const formatKda = ({ kills, deaths, assists }: KDA): string => `${kills}/${deaths}/${assists}`

/** Text for the Share button, like the Daily's. */
export function matchShareText(
  match: MatchResult,
  teams: MatchTeams,
  summary: MatchSummary,
  opponentLabel: string,
  url: string,
): string {
  const last = match.events[match.events.length - 1]
  const result = match.winner === 'blue' ? 'Victory 🏆' : 'Defeat 💀'
  const mvp = teams[summary.mvp.side].rating.champions.find(({ role }) => role === summary.mvp.role)
  const score = last
    ? `Kills ${last.score.blue.kills}–${last.score.red.kills} · Towers ${last.score.blue.towers}–${last.score.red.towers} · Dragons ${last.score.blue.dragons}–${last.score.red.dragons}`
    : ''
  return [
    'Rift of Fortune · Match vs Bots',
    `${result} vs ${teams.red.name} (${opponentLabel}) in ${formatGameTime(match.duration)}`,
    score,
    ...(mvp ? [`MVP: ${mvp.champion.name} ${formatKda(summary.mvp.kda)}`] : []),
    url,
  ].join('\n')
}
