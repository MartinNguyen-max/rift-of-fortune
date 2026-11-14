import type { Champion, Role } from '../../data/types'
import type { Side } from '../match/types'
import { pickRandom, type RandomFn } from '../random'
import { ROLES } from '../roles'
import { tieBreaker } from './liveEvents'
import type { RoundState } from './session'
import type { EncodedTeam } from './teamCode'

/**
 * Five lanes, no champ select: each player gets a random team with real positions. The five
 * champions are five lives; the lanes fight in order (top, jungle, mid, ADC, support), each in
 * one mini-game against the friend. The champion who loses their lane is dead.
 */
export const LANE_ORDER: readonly Role[] = ROLES
export const LIVES = LANE_ORDER.length

/** A champion who really plays the role: their main role first, then any role they play. */
function laneChampion(pool: readonly Champion[], role: Role, taken: ReadonlySet<string>, random: RandomFn): Champion {
  const free = pool.filter(({ id }) => !taken.has(id))
  const mains = free.filter(({ positions }) => positions[0] === role)
  const players = free.filter(({ positions }) => positions.includes(role))
  return pickRandom(mains.length > 0 ? mains : players.length > 0 ? players : free, random)
}

/** A random team for five lanes. Items don't matter: the champions are lives. */
export function laneTeam(pool: readonly Champion[], random: RandomFn): EncodedTeam {
  const taken = new Set<string>()
  return LANE_ORDER.map((role) => {
    const champion = laneChampion(pool, role, taken, random)
    taken.add(champion.id)
    return { role, champion: champion.id, items: [] }
  })
}

/** Each side's champion per lane, in lane order (the host on blue). */
export function laneChampions(round: Pick<RoundState, 'match'>, pool: readonly Champion[]): Record<Side, (Champion | null)[]> | null {
  if (!round.match) return null
  const lineUp = (team: EncodedTeam | undefined) =>
    LANE_ORDER.map((role) => {
      const id = team?.find((member) => member.role === role)?.champion
      return pool.find((champion) => champion.id === id) ?? null
    })
  return { blue: lineUp(round.match.teams[0]), red: lineUp(round.match.teams[1]) }
}

/** How a lane ended: a side won it, or a tie, where both champions live. */
export type LaneResult = Side | 'draw'

/** The results of the lanes decided so far, in order, stopping at the first open one. */
export function laneResults(round: Pick<RoundState, 'events'>): LaneResult[] {
  const results: LaneResult[] = []
  for (const { result } of round.events) {
    if (!result) break
    results.push(result.tie ? 'draw' : result.winner)
  }
  return results
}

const otherSide = (side: Side): Side => (side === 'blue' ? 'red' : 'blue')

/** Lives left for a side after these lanes: one lost per lane lost. */
export const livesLeft = (results: readonly LaneResult[], side: Side): number =>
  LIVES - results.filter((result) => result === otherSide(side)).length

export interface LanesOutcome {
  winner: Side
  lives: Record<Side, number>
  /** Lives were level after all five lanes, so a coin flip decided. */
  coinFlip: boolean
}

/** The winner once all `lanes` are fought: most lives left, or a coin flip when level. */
export function lanesOutcome(results: readonly LaneResult[], lanes: number, seed: number): LanesOutcome | null {
  if (results.length < lanes) return null
  const lives = { blue: livesLeft(results, 'blue'), red: livesLeft(results, 'red') }
  if (lives.blue === lives.red) return { winner: tieBreaker(seed, LIVES), lives, coinFlip: true }
  return { winner: lives.blue > lives.red ? 'blue' : 'red', lives, coinFlip: false }
}
