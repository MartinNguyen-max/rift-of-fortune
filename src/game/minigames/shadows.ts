import { seededRandom } from '../random'
import { stepSeed, type BothMoves, type GameSetup, type MiniGameRules, type Owed, type Player, type Settled } from './versus'

/**
 * Zed and two Living Shadows stand in a row. The real Zed is pointed out, then all three turn
 * alike and swap places, fast, with feints. Tap the real Zed: no clock, only a right pick counts.
 * Three rounds, each harder. Most found wins; the same number found is a tie.
 */

/** The three spots in the row, left to right. */
export type Spot = 0 | 1 | 2
export const SPOTS: readonly Spot[] = [0, 1, 2]

/** One move of the shuffle: the two figures on `from` and `to` trade places. A feint stops halfway and goes back. */
export interface ShadowSwap {
  from: Spot
  to: Spot
  feint: boolean
}

export interface ShadowRound {
  /** Where the real Zed stands when he is pointed out. */
  start: Spot
  swaps: ShadowSwap[]
  /** How long one swap (or feint) takes, in ms. */
  swapMs: number
}

/**
 * Each round: real swaps, how fast, and how many feints are mixed in. Hard from the start, and the
 * last round is close to impossible: very fast, long, and full of feints, but it can be followed.
 */
export const SHADOW_ROUNDS = [
  { swaps: 11, swapMs: 240, feints: 3 },
  { swaps: 13, swapMs: 200, feints: 4 },
  { swaps: 16, swapMs: 165, feints: 6 },
] as const

export const SHADOW_TIMING = {
  /** The real Zed is pointed out this long (longer in the first round, to get ready)... */
  showMs: 1100,
  firstShowMs: 1800,
  /** ...then he turns into a shadow like the others. */
  blendMs: 400,
  /** No clock shows and speed doesn't count: this only ends a round nobody picks in. */
  pickMs: 15_000,
  /** A finished round stays up this long before the next one. */
  betweenMs: 2600,
} as const

/** Rounds per game, solo and Multiplayer alike. */
export const shadowRoundCount = (): number => SHADOW_ROUNDS.length

const PAIRS: readonly (readonly [Spot, Spot])[] = [
  [0, 1],
  [1, 2],
  [0, 2],
]

/** The shuffle of one round, the same for everyone with the same seed. */
export function shadowRound(seed: number, round: number): ShadowRound {
  const config = SHADOW_ROUNDS[Math.min(round, SHADOW_ROUNDS.length - 1)] ?? SHADOW_ROUNDS[0]
  const random = seededRandom(seed)
  const start = Math.floor(random() * 3) as Spot
  const pickPair = (not: number) => {
    const options = PAIRS.map((_, index) => index).filter((index) => index !== not)
    return options[Math.floor(random() * options.length)] ?? 0
  }
  const swaps: ShadowSwap[] = []
  let last = -1
  for (let index = 0; index < config.swaps; index++) {
    // Never the same pair twice in a row: that would just undo the swap.
    last = pickPair(last)
    const [a, b] = PAIRS[last] ?? [0, 1]
    const flip = random() < 0.5
    swaps.push({ from: flip ? b : a, to: flip ? a : b, feint: false })
  }
  for (let feint = 0; feint < config.feints; feint++) {
    const [a, b] = PAIRS[Math.floor(random() * PAIRS.length)] ?? [0, 1]
    // Never first: the first move is always a real swap.
    const at = 1 + Math.floor(random() * swaps.length)
    swaps.splice(at, 0, { from: a, to: b, feint: true })
  }
  return { start, swaps, swapMs: config.swapMs }
}

/** The round of one step of the game. */
export const roundOfStep = (setup: GameSetup, step: number): ShadowRound => shadowRound(stepSeed(setup.seed, step, 71), step)

/** How long the shuffle of a round takes, in ms. */
export const shuffleMs = (round: ShadowRound): number => round.swaps.length * round.swapMs

/** Which figure stands on each spot after the first `count` swaps. Figure `n` starts on spot `n`. */
export function figuresAfter(round: ShadowRound, count = round.swaps.length): Spot[] {
  const figures: Spot[] = [0, 1, 2]
  for (const { from, to, feint } of round.swaps.slice(0, count)) {
    if (feint) continue
    const moving = figures[from] ?? from
    figures[from] = figures[to] ?? to
    figures[to] = moving
  }
  return figures
}

/** Where the real Zed ends up. */
export function realSpot(round: ShadowRound): Spot {
  return figuresAfter(round).indexOf(round.start) as Spot
}

// ── Moves: a pick is the spot ─────────

/** "Spot" 3 means no pick in time. */
export const NO_PICK = 3

/** A pick; anything that isn't a spot is no pick. */
export const readPick = (move: number): Spot | null => (move === 0 || move === 1 || move === 2 ? move : null)

export const isRightPick = (round: ShadowRound, move: number): boolean => readPick(move) === realSpot(round)

export interface ShadowPickResult {
  /** Null when time ran out. */
  spot: Spot | null
  right: boolean
}

/** Who wins a round: the only right pick. Null when both were right, or both wrong. */
export function roundWinner(mine: ShadowPickResult, theirs: ShadowPickResult): Player | null {
  if (mine.right === theirs.right) return null
  return mine.right ? 0 : 1
}

/** How often Zed was found: the score, and the personal best. */
export const foundCount = (picks: readonly ShadowPickResult[]): number => picks.filter(({ right }) => right).length

/** "2/3 found" */
export const formatFound = (found: number): string => `${found}/${SHADOW_ROUNDS.length}\u00a0found`

/** Each player's picks so far, right or wrong, by round. */
export function shadowPicks(moves: BothMoves, setup: GameSetup): [ShadowPickResult[], ShadowPickResult[]] {
  const picks: [ShadowPickResult[], ShadowPickResult[]] = [[], []]
  for (let step = 0; step < shadowRoundCount(); step++) {
    const round = roundOfStep(setup, step)
    for (const player of [0, 1] as const) {
      const move = moves[player][step]
      if (move !== undefined) picks[player].push({ spot: readPick(move), right: isRightPick(round, move) })
    }
  }
  return picks
}

/** The winner of each round both players have picked in, in order. */
export function roundWinners(moves: BothMoves, setup: GameSetup): (Player | null)[] {
  const [mine, theirs] = shadowPicks(moves, setup)
  return mine.flatMap((pick, round) => {
    const their = theirs[round]
    return their ? [roundWinner(pick, their)] : []
  })
}

function settle(moves: BothMoves, setup: GameSetup): Settled | null {
  const rounds = shadowRoundCount()
  const [mine, theirs] = shadowPicks(moves, setup)
  if (mine.length < rounds || theirs.length < rounds) return null
  const scores: [number, number] = [foundCount(mine), foundCount(theirs)]
  const winner: Player | null = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1
  return { winner, scores }
}

function owed(moves: BothMoves): Owed[] {
  return ([0, 1] as const).flatMap((player) => {
    const missing = moves[player].findIndex((move) => move === undefined)
    const next = missing === -1 ? moves[player].length : missing
    return next < shadowRoundCount() ? [{ player, step: next }] : []
  })
}

/**
 * Akali, the bot: like most people she finds Zed about once or twice a game: often in the first
 * round, and in the last only about as often as a lucky guess.
 */
export const BOT_SHADOWS = { accuracy: [0.55, 0.42, 0.34] } as const

export function botPick(round: ShadowRound, step: number, seed: number): number {
  const random = seededRandom(seed ^ 0x2c1b3c6d)
  const accuracy = BOT_SHADOWS.accuracy[Math.min(step, BOT_SHADOWS.accuracy.length - 1)] ?? 0.5
  const right = realSpot(round)
  const wrong = SPOTS.filter((spot) => spot !== right)
  return random() < accuracy ? right : (wrong[Math.floor(random() * wrong.length)] ?? right)
}

/** The longest a round can take on screen, in ms. A real pick comes long before the limit. */
export function roundMs(step: number, setup: GameSetup): number {
  const show = step === 0 ? SHADOW_TIMING.firstShowMs : SHADOW_TIMING.showMs
  return show + SHADOW_TIMING.blendMs + shuffleMs(roundOfStep(setup, step)) + SHADOW_TIMING.pickMs + SHADOW_TIMING.betweenMs
}

export const SHADOW_RULES: MiniGameRules = {
  chances: 1,
  liveSeconds: (setup) => Math.ceil(Array.from({ length: shadowRoundCount() }, (_, step) => roundMs(step, setup)).reduce((a, b) => a + b, 0) / 1000),
  owed,
  settle,
  fallback: () => NO_PICK,
  botMove: (step, _moves, setup) =>
    step < shadowRoundCount() ? botPick(roundOfStep(setup, step), step, stepSeed(setup.seed, step, 73)) : undefined,
  formatScore: (score) => formatFound(score),
  best: {
    of: (moves, setup) => settle(moves, setup)?.scores[0] ?? null,
    lowerIsBetter: false,
    format: formatFound,
  },
}
