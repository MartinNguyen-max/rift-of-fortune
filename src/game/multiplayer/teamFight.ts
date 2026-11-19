import type { Side } from '../match/types'
import { seededRandom } from '../random'

/** How a team-only game was won: the higher team rating, or a coin flip on equal ratings. */
export interface TeamFightResult {
  winner: Side
  coinFlip: boolean
}

/**
 * A draft battle without live events: the higher team rating wins. Equal ratings are a coin flip
 * from the match seed, so both players (and anyone who rejoins) get the same winner.
 */
export function teamFightWinner(ratings: Record<Side, number>, seed: number): TeamFightResult {
  if (ratings.blue !== ratings.red) return { winner: ratings.blue > ratings.red ? 'blue' : 'red', coinFlip: false }
  return { winner: seededRandom(seed)() < 0.5 ? 'blue' : 'red', coinFlip: true }
}
