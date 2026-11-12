import type { Role } from '../../data/types'
import { ROLES } from '../roles'
import { describeEvent, formatGameTime, lowercaseYourMidSentence, type CommentaryLine, type MatchLines } from './commentary'
import { winChanceTimeline } from './winChance'
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

/** How well a champion played: kills and assists count for, deaths against. */
const kdaValue = ({ kills, deaths, assists }: KDA) => kills * 3 + assists * 1.5 - deaths * 1.5

/** The best K/D/A on the winning team: only the winners can have the MVP. */
export function findMvp(match: MatchResult): MatchMvp {
  const stats = match.stats[match.winner]
  const role = ROLES.reduce((best, current) => (kdaValue(stats[current]) > kdaValue(stats[best]) ? current : best))
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

/** Below this gap from 50%, the draft was a coin flip. */
const COIN_FLIP_MARGIN = 0.05

const percent = (chance: number) => Math.round(chance * 100)

/**
 * How the match went in a few sentences: who had the better team on paper, the turning point
 * (or how the favourite closed it out), and who carried and who fed.
 */
export function matchStory(match: MatchResult, teams: MatchTeams, summary: MatchSummary): string[] {
  const chances = winChanceTimeline(match, teams)
  const chanceFor = (side: Side, blueChance: number) => (side === 'blue' ? blueChance : 1 - blueChance)
  const winner = match.winner
  const loser: Side = winner === 'blue' ? 'red' : 'blue'
  const before = chances[0] ?? 0.5
  const favourite: Side = before >= 0.5 ? 'blue' : 'red'

  const opening =
    Math.abs(before - 0.5) < COIN_FLIP_MARGIN
      ? `On paper it was a coin flip (${percent(Math.max(before, 1 - before))}% to ${percent(Math.min(before, 1 - before))}%).`
      : `${teams[favourite].name} had the better team on paper (${percent(chanceFor(favourite, before))}% to win).`

  // The event that moved the win chance most toward the winner, not counting the ending itself.
  const during = match.events.slice(0, -1)
  let turn = -1
  let turnSwing = 0
  for (const index of during.keys()) {
    const swing = chanceFor(winner, chances[index + 1] ?? 0) - chanceFor(winner, chances[index] ?? 0)
    if (swing > turnSwing) {
      turn = index
      turnSwing = swing
    }
  }
  const loserPeak = Math.max(...chances.slice(0, -1).map((chance) => chanceFor(loser, chance)))
  const turning = match.events[turn]
  const when = turning ? { time: formatGameTime(turning.time), what: describeEvent(turning, teams) } : null
  const moment = when && `at ${when.time} ${when.what}`

  const middle = !moment || !when
    ? null
    : favourite !== winner
      ? `${teams[loser].name} was ${percent(loserPeak)}% to win, but ${moment} and the game turned.`
      : loserPeak > 0.5
        ? `${teams[loser].name} got ahead (${percent(loserPeak)}%), but ${moment} and swung it back.`
        : `${teams[winner].name} never let go: the biggest moment came at ${when.time}, when ${when.what}.`

  const name = ({ side, role }: { side: Side; role: Role }) =>
    teams[side].rating.champions.find((champion) => champion.role === role)?.champion.name ?? ''
  const feeder = summary.feeder
  const carry = `${name(summary.mvp)} carried with ${formatKda(summary.mvp.kda)}`
  const closing =
    feeder && name(feeder) !== name(summary.mvp)
      ? `${carry}, while ${name(feeder)} went ${formatKda(match.stats[feeder.side][feeder.role])}.`
      : `${carry}.`

  return [opening, middle, closing].flatMap((sentence) => (sentence ? [lowercaseYourMidSentence(sentence)] : []))
}


/** The best and the worst player so far, on either team, for the live scoreboard. */
export function standouts(stats: ChampionStats): { best: ChampionRef | null; worst: ChampionRef | null } {
  let best: ChampionRef | null = null
  let bestValue = 0
  for (const side of SIDES) {
    for (const role of ROLES) {
      const value = kdaValue(stats[side][role])
      if (value > bestValue) {
        best = { side, role }
        bestValue = value
      }
    }
  }
  const worst = mostDeaths(stats)
  const same = best && worst && best.side === worst.side && best.role === worst.role
  return { best, worst: same ? null : worst }
}
