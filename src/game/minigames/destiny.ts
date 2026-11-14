import { seededRandom } from '../random'
import { isLane, LANES, randomLane, type Lane } from './riftLanes'
import {
  firstPlayer,
  other,
  stepSeed,
  type BothMoves,
  type GameSetup,
  type MiniGameRules,
  type Owed,
  type Player,
  type Settled,
} from './versus'

/**
 * Global Gank: Twisted Fate and Nocturne take turns ganking. The ganker picks a lane in secret,
 * then the other player guesses it. A right guess counters the gank: +1 for the guesser.
 * A wrong guess (or none) lets the gank through: +1 for the ganker.
 */
export const GANK_POINT = 1

/** A guesser who ran out of time guesses nothing. */
export const NO_GUESS = 3

/** Seconds for each choice. */
export const DESTINY_SECONDS = { gank: { solo: 6, live: 8 }, guess: { solo: 6, live: 8 } } as const

/** Solo plays three rounds as each. Multiplayer plays one, or one each with both roles. */
export const DESTINY_SOLO_HALVES = 6

export const destinyHalves = (setup: GameSetup): number =>
  setup.variant === 'solo' ? DESTINY_SOLO_HALVES : setup.bothRoles ? 2 : 1

/** Who ganks in each half: the first player in even halves, the other one in odd halves. */
export function gankerOf(half: number, setup: GameSetup): Player {
  const first = firstPlayer(setup)
  return half % 2 === 0 ? first : other(first)
}

/** Out of time: the gank goes mid, the most obvious play there is. */
export const TIMEOUT_GANK: Lane = 1

/** A gank move; anything malformed is a gank mid. */
export const readGank = (move: number): Lane => (isLane(move) ? move : TIMEOUT_GANK)

// ── Results ─────────

export interface DestinyHalf {
  ganker: Player
  lane: Lane
  /** The guessed lane, or null for no guess. */
  guess: Lane | null
  countered: boolean
}

/** Every finished half, in order. */
export function destinyResults(moves: BothMoves, setup: GameSetup): DestinyHalf[] {
  const results: DestinyHalf[] = []
  for (let half = 0; half < destinyHalves(setup); half++) {
    const ganker = gankerOf(half, setup)
    const ganked = moves[ganker][half]
    const guessed = moves[other(ganker)][half]
    if (ganked === undefined || guessed === undefined) break
    const lane = readGank(ganked)
    const guess = isLane(guessed) ? guessed : null
    results.push({ ganker, lane, guess, countered: guess === lane })
  }
  return results
}

/** Who scores a half: the guesser on a right guess, the ganker otherwise. */
export const halfScorer = ({ ganker, countered }: DestinyHalf): Player => (countered ? other(ganker) : ganker)

/** Points so far, by player. */
export function destinyPoints(results: readonly DestinyHalf[]): [number, number] {
  const points: [number, number] = [0, 0]
  for (const result of results) points[halfScorer(result)] += GANK_POINT
  return points
}

function settle(moves: BothMoves, setup: GameSetup): Settled | null {
  const results = destinyResults(moves, setup)
  if (results.length < destinyHalves(setup)) return null
  const scores = destinyPoints(results)
  const winner: Player | null = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1
  return { winner, scores }
}

function owed(moves: BothMoves, setup: GameSetup): Owed[] {
  const half = destinyResults(moves, setup).length
  if (half >= destinyHalves(setup)) return []
  const ganker = gankerOf(half, setup)
  // The guess comes once the gank is locked in.
  if (moves[ganker][half] === undefined) return [{ player: ganker, step: half }]
  return [{ player: other(ganker), step: half }]
}

// ── The bot ─────────

/**
 * The bot ganks a random lane. As the guesser it reads you a little: this often it guesses the
 * lane you ganked most before, otherwise any lane.
 */
export const BOT_DESTINY = { readYou: 0.4 } as const

/** The lane you ganked most often (the latest one on a tie), or null before your first gank. */
export function favoriteLane(yourGanks: readonly DestinyHalf[]): Lane | null {
  const counts = [0, 0, 0]
  let favorite: Lane | null = null
  for (const { lane } of yourGanks) {
    counts[lane] = (counts[lane] ?? 0) + 1
    if (favorite === null || (counts[lane] ?? 0) >= (counts[favorite] ?? 0)) favorite = lane
  }
  return favorite
}

function botMove(step: number, moves: BothMoves, setup: GameSetup): number | undefined {
  if (step >= destinyHalves(setup)) return undefined
  const random = seededRandom(stepSeed(setup.seed, step, 83))
  if (gankerOf(step, setup) === 1) return randomLane(random)
  // The bot guesses once your gank is in, reading only your earlier ganks.
  if (moves[0][step] === undefined) return undefined
  const favorite = favoriteLane(destinyResults(moves, setup).filter(({ ganker }) => ganker === 0))
  if (favorite !== null && random() < BOT_DESTINY.readYou) return favorite
  return LANES[Math.floor(random() * LANES.length)] ?? 1
}

export const DESTINY_RULES: MiniGameRules = {
  chances: 2,
  liveSeconds: (setup) => destinyHalves(setup) * (DESTINY_SECONDS.gank.live + DESTINY_SECONDS.guess.live + 5),
  owed,
  settle,
  // A ganker out of time ganks mid; a guesser out of time guesses nothing.
  fallback: ({ player, step }, _moves, setup) => (gankerOf(step, setup) === player ? TIMEOUT_GANK : NO_GUESS),
  botMove,
  formatScore: (points) => `${points} ${points === 1 ? 'point' : 'points'}`,
}
