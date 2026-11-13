import { seededRandom } from '../random'
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
 * I Was Hiding: one player hides their jungler in one of three bushes, the other guesses which.
 * A right guess scores for the guesser, anything else for the hider. A move is a bush (0–2), or
 * NO_GUESS for a guesser who ran out of time.
 */
export const BUSHES = ['top', 'mid', 'bot'] as const
export type Bush = 0 | 1 | 2
export const BUSH_COUNT = BUSHES.length
export const NO_GUESS = 3

/** Seconds to hide or to guess. */
export const PICK_SECONDS = { solo: 6, live: 8 } as const

/** Solo plays three rounds in each role. Multiplayer plays one round, or one each with both roles. */
export const SOLO_HALVES = 6

export const isBush = (value: number): value is Bush => value === 0 || value === 1 || value === 2

/** Who hides in each half: the first player in even halves, the other one in odd halves. */
export function hiderOf(half: number, setup: GameSetup): Player {
  const first = firstPlayer(setup)
  return half % 2 === 0 ? first : other(first)
}

export const gankHalves = (setup: GameSetup): number => (setup.variant === 'solo' ? SOLO_HALVES : setup.bothRoles ? 2 : 1)

export interface GankHalf {
  hider: Player
  bush: Bush
  /** The guessed bush, or null for no guess. */
  guess: Bush | null
  found: boolean
}

/** Every finished half, in order. */
export function gankResults(moves: BothMoves, setup: GameSetup): GankHalf[] {
  const results: GankHalf[] = []
  for (let half = 0; half < gankHalves(setup); half++) {
    const hider = hiderOf(half, setup)
    const hidden = moves[hider][half]
    const guessed = moves[other(hider)][half]
    if (hidden === undefined || guessed === undefined) break
    const bush: Bush = isBush(hidden) ? hidden : 1
    const guess = isBush(guessed) ? guessed : null
    results.push({ hider, bush, guess, found: guess === bush })
  }
  return results
}

/** Points so far: a right guess for the guesser, a wrong (or no) guess for the hider. */
export function gankPoints(results: readonly GankHalf[]): [number, number] {
  const points: [number, number] = [0, 0]
  for (const { hider, found } of results) points[found ? other(hider) : hider] += 1
  return points
}

function settle(moves: BothMoves, setup: GameSetup): Settled | null {
  const results = gankResults(moves, setup)
  if (results.length < gankHalves(setup)) return null
  const scores = gankPoints(results)
  const winner: Player | null = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1
  return { winner, scores }
}

function owed(moves: BothMoves, setup: GameSetup): Owed[] {
  const half = gankResults(moves, setup).length
  if (half >= gankHalves(setup)) return []
  const hider = hiderOf(half, setup)
  // The guesser can only guess once the jungler is hidden.
  if (moves[hider][half] === undefined) return [{ player: hider, step: half }]
  return [{ player: other(hider), step: half }]
}

/** The bush the player hid in most often, if one stands out. */
export function favoriteBush(bushes: readonly Bush[]): Bush | null {
  const counts = [0, 1, 2].map((bush) => bushes.filter((value) => value === bush).length)
  const most = Math.max(...counts)
  const favorites = counts.flatMap((count, bush) => (count === most && isBush(bush) ? [bush] : []))
  return most > 0 && favorites.length === 1 ? (favorites[0] ?? null) : null
}

/** How often the bot guesses the bush you like best instead of a random one. */
export const BOT_READS_YOU = 0.5

const randomBush = (random: () => number): Bush => {
  const bush = Math.floor(random() * BUSH_COUNT)
  return isBush(bush) ? bush : 1
}

function botMove(step: number, moves: BothMoves, setup: GameSetup): number | undefined {
  if (step >= gankHalves(setup)) return undefined
  const random = seededRandom(stepSeed(setup.seed, step, 53))
  if (hiderOf(step, setup) === 1) return randomBush(random)
  // The bot guesses once you are hidden, from your earlier hiding spots only.
  if (moves[0][step] === undefined) return undefined
  const earlier = gankResults(moves, setup)
    .filter(({ hider }) => hider === 0)
    .map(({ bush }) => bush)
  const favorite = favoriteBush(earlier)
  return favorite !== null && random() < BOT_READS_YOU ? favorite : randomBush(random)
}

export const GANK_RULES: MiniGameRules = {
  chances: 2,
  liveSeconds: (setup) => gankHalves(setup) * (PICK_SECONDS.live * 2 + 4),
  owed,
  settle,
  // A hider out of time stands in the middle bush; a guesser out of time doesn't guess.
  fallback: ({ player, step }, _moves, setup) => (hiderOf(step, setup) === player ? 1 : NO_GUESS),
  botMove,
  formatScore: (points) => `${points} ${points === 1 ? 'point' : 'points'}`,
}
