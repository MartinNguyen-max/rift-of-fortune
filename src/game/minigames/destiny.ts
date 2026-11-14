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
 * Global Gank: one player ganks, the other guesses, the whole game (no switching). Each round the
 * ganker picks a lane in secret, then the guesser guesses it. A right guess counters the gank and
 * is worth 2 to the guesser; a wrong guess (or none) lets the gank through, 1 to the ganker. Over
 * 5 ganks that means 2 right guesses win it for the guesser: about a fair fight, and never a tie.
 */
export const DESTINY_POINTS = { gank: 1, counter: 2 } as const

/** A guesser who ran out of time guesses nothing. */
export const NO_GUESS = 3

/** Seconds for each choice. */
export const DESTINY_SECONDS = { gank: { solo: 6, live: 5 }, guess: { solo: 6, live: 5 } } as const

/** Ganks per game, solo and Multiplayer alike. */
export const DESTINY_GANKS = 5

export const destinyHalves = (): number => DESTINY_GANKS

/** The ganker, every round: you in solo, the seed's player in Multiplayer. */
export const gankerOf = (setup: GameSetup): Player => firstPlayer(setup)

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
  const ganker = gankerOf(setup)
  for (let half = 0; half < DESTINY_GANKS; half++) {
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

/** What a half is worth to its scorer: 2 for a right guess, 1 for a gank that got through. */
export const halfPoints = ({ countered }: DestinyHalf): number => (countered ? DESTINY_POINTS.counter : DESTINY_POINTS.gank)

/** Points so far, by player. */
export function destinyPoints(results: readonly DestinyHalf[]): [number, number] {
  const points: [number, number] = [0, 0]
  for (const result of results) points[halfScorer(result)] += halfPoints(result)
  return points
}

function settle(moves: BothMoves, setup: GameSetup): Settled | null {
  const results = destinyResults(moves, setup)
  if (results.length < DESTINY_GANKS) return null
  const scores = destinyPoints(results)
  const winner: Player | null = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1
  return { winner, scores }
}

function owed(moves: BothMoves, setup: GameSetup): Owed[] {
  const half = destinyResults(moves, setup).length
  if (half >= DESTINY_GANKS) return []
  const ganker = gankerOf(setup)
  // The guess comes once the gank is locked in.
  if (moves[ganker][half] === undefined) return [{ player: ganker, step: half }]
  return [{ player: other(ganker), step: half }]
}

// ── The bot ─────────

/**
 * The bot always guesses (you gank in solo). It reads you a little: this often it guesses the
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
  if (step >= DESTINY_GANKS) return undefined
  const random = seededRandom(stepSeed(setup.seed, step, 83))
  if (gankerOf(setup) === 1) return randomLane(random)
  // The bot guesses once your gank is in, reading only your earlier ganks.
  if (moves[0][step] === undefined) return undefined
  const favorite = favoriteLane(destinyResults(moves, setup))
  if (favorite !== null && random() < BOT_DESTINY.readYou) return favorite
  return LANES[Math.floor(random() * LANES.length)] ?? 1
}

export const DESTINY_RULES: MiniGameRules = {
  // One role each for the whole game, so one chance in Multiplayer.
  chances: 1,
  // Both choices and the reveal (about 3.6 s) for each gank.
  liveSeconds: () => DESTINY_GANKS * (DESTINY_SECONDS.gank.live + DESTINY_SECONDS.guess.live + 4),
  owed,
  settle,
  // A ganker out of time ganks mid; a guesser out of time guesses nothing.
  fallback: ({ player }, _moves, setup) => (gankerOf(setup) === player ? TIMEOUT_GANK : NO_GUESS),
  botMove,
  formatScore: (points) => `${points} ${points === 1 ? 'point' : 'points'}`,
}
