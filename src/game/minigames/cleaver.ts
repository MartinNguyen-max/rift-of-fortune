import type { RandomFn } from '../random'

/** The three lanes a Mundo can stand in and throw down. */
export const LANES = ['top', 'mid', 'bot'] as const
export type Lane = (typeof LANES)[number]

/** Cleaver hits to win. */
export const CLEAVER_HITS_TO_WIN = 3
/** Seconds to pick a lane each round. */
export const PICK_SECONDS = 3
/** Where the dodger stands if they don't move: Mundo is lazy. */
export const DEFAULT_LANE: Lane = 'mid'

export type Side = 'player' | 'bot'

export interface CleaverRound {
  thrower: Side
  throwLane: Lane
  dodgeLane: Lane
}

/** The player throws first, then the Mundos switch every round. */
export const throwerOfRound = (index: number): Side => (index % 2 === 0 ? 'player' : 'bot')

export const isHit = (round: CleaverRound): boolean => round.throwLane === round.dodgeLane

/** Cleavers each side has taken. */
export function hitsTaken(rounds: readonly CleaverRound[]): Record<Side, number> {
  const taken = { player: 0, bot: 0 }
  for (const round of rounds) {
    if (isHit(round)) taken[round.thrower === 'player' ? 'bot' : 'player'] += 1
  }
  return taken
}

/** The winner once a Mundo has taken CLEAVER_HITS_TO_WIN cleavers. */
export function cleaverWinner(rounds: readonly CleaverRound[]): Side | null {
  const taken = hitsTaken(rounds)
  if (taken.bot >= CLEAVER_HITS_TO_WIN) return 'player'
  if (taken.player >= CLEAVER_HITS_TO_WIN) return 'bot'
  return null
}

const randomLane = (random: RandomFn): Lane => LANES[Math.floor(random() * LANES.length)] ?? DEFAULT_LANE

/** The lane picked most often in `lanes`, or null if there's no clear favorite. */
export function favoriteLane(lanes: readonly Lane[]): Lane | null {
  const counts = LANES.map((lane) => ({ lane, count: lanes.filter((value) => value === lane).length }))
  const [first, second] = counts.toSorted((a, b) => b.count - a.count)
  return first && second && first.count > second.count ? first.lane : null
}

/** How often the bot plays the player's habits instead of picking at random. */
export const BOT_READS_YOU = 0.5

/** The bot throws where the player likes to dodge, half the time. */
export function botThrow(playerDodges: readonly Lane[], random: RandomFn): Lane {
  const favorite = favoriteLane(playerDodges)
  return favorite && random() < BOT_READS_YOU ? favorite : randomLane(random)
}

/** The bot dodges away from the player's favorite throw, half the time. */
export function botDodge(playerThrows: readonly Lane[], random: RandomFn): Lane {
  const favorite = favoriteLane(playerThrows)
  if (favorite && random() < BOT_READS_YOU) {
    const others = LANES.filter((lane) => lane !== favorite)
    return others[Math.floor(random() * others.length)] ?? DEFAULT_LANE
  }
  return randomLane(random)
}

/** The lane one step up or down from `lane`, staying on the map. */
export function stepLane(lane: Lane, step: -1 | 1): Lane {
  const index = Math.min(LANES.length - 1, Math.max(0, LANES.indexOf(lane) + step))
  return LANES[index] ?? lane
}
