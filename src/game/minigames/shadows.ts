import { seededRandom } from '../random'
import { stepSeed, type BothMoves, type GameSetup, type MiniGameRules, type Owed, type Player, type Settled } from './versus'

/**
 * Zed and two Living Shadows stand in a row. The real Zed is pointed out, then all three turn
 * alike and swap places. Tap the real Zed. Three rounds, each with more and faster swaps (and
 * feints from round 2). Most right picks wins; on a tie, the faster picks.
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

/** Each round: real swaps, how fast, and how many feints are mixed in. */
export const SHADOW_ROUNDS = [
  { swaps: 5, swapMs: 600, feints: 0 },
  { swaps: 7, swapMs: 460, feints: 1 },
  { swaps: 9, swapMs: 360, feints: 2 },
] as const

export const SHADOW_TIMING = {
  /** The real Zed is pointed out this long (longer in the first round, to get ready)... */
  showMs: 1700,
  firstShowMs: 2600,
  /** ...then he turns into a shadow like the others. */
  blendMs: 650,
  /** Time to pick once the shuffle stops. */
  pickMs: 5000,
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

// ── Moves: a pick is the spot and how fast, packed in one number ─────────

/** The slowest pick time that counts, in ms. */
export const PICK_CAP_MS = SHADOW_TIMING.pickMs
/** "Spot" 3 means no pick in time. */
const NO_SPOT = 3

export interface ShadowPick {
  /** Null when time ran out. */
  spot: Spot | null
  ms: number
}

export const pickMove = (spot: Spot | null, ms: number): number =>
  Math.min(PICK_CAP_MS, Math.max(0, Math.round(ms))) * 4 + (spot ?? NO_SPOT)

export function readPick(move: number): ShadowPick {
  const spot = move % 4
  return { spot: spot === NO_SPOT ? null : (spot as Spot), ms: Math.floor(move / 4) }
}

/** The move for a player who never picked: no pick, at the time limit. */
export const NO_PICK = pickMove(null, PICK_CAP_MS)

export const isRightPick = (round: ShadowRound, move: number): boolean => readPick(move).spot === realSpot(round)

// ── Scores: right picks first, then speed ─────────

/** A score is `right × SCORE_BASE` plus a bonus for speed, so higher is always better. */
export const SCORE_BASE = 100_000

/** Right picks, then the time spent on them: faster is better. No right pick scores 0. */
export function shadowScore(picks: readonly { right: boolean; ms: number }[]): number {
  const right = picks.filter((pick) => pick.right)
  if (right.length === 0) return 0
  const ms = Math.min(
    SCORE_BASE - 1,
    right.reduce((total, pick) => total + pick.ms, 0),
  )
  return right.length * SCORE_BASE + (SCORE_BASE - 1 - ms)
}

export const rightOfScore = (score: number): number => Math.floor(score / SCORE_BASE)
export const msOfScore = (score: number): number => (score === 0 ? 0 : SCORE_BASE - 1 - (score % SCORE_BASE))

/** "2/3 · 1.9 s": right picks, and the time they took. */
export function formatShadowScore(score: number): string {
  const right = rightOfScore(score)
  const found = `${right}/${SHADOW_ROUNDS.length}`
  return right === 0 ? found : `${found} · ${(msOfScore(score) / 1000).toFixed(1)} s`
}

export interface ShadowPickResult extends ShadowPick {
  right: boolean
}

/** Each player's picks so far, right or wrong, by round. */
export function shadowPicks(moves: BothMoves, setup: GameSetup): [ShadowPickResult[], ShadowPickResult[]] {
  const picks: [ShadowPickResult[], ShadowPickResult[]] = [[], []]
  for (let step = 0; step < shadowRoundCount(); step++) {
    const round = roundOfStep(setup, step)
    for (const player of [0, 1] as const) {
      const move = moves[player][step]
      if (move !== undefined) picks[player].push({ ...readPick(move), right: isRightPick(round, move) })
    }
  }
  return picks
}

function settle(moves: BothMoves, setup: GameSetup): Settled | null {
  const rounds = shadowRoundCount()
  const [mine, theirs] = shadowPicks(moves, setup)
  if (mine.length < rounds || theirs.length < rounds) return null
  const scores: [number, number] = [shadowScore(mine), shadowScore(theirs)]
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

/** The bot follows well at first, worse as the shuffle speeds up. */
export const BOT_SHADOWS = { accuracy: [0.9, 0.72, 0.52], pickMs: { min: 650, max: 1700 } } as const

export function botPick(round: ShadowRound, step: number, seed: number): number {
  const random = seededRandom(seed ^ 0x2c1b3c6d)
  const accuracy = BOT_SHADOWS.accuracy[Math.min(step, BOT_SHADOWS.accuracy.length - 1)] ?? 0.5
  const right = realSpot(round)
  const wrong = SPOTS.filter((spot) => spot !== right)
  const spot = random() < accuracy ? right : (wrong[Math.floor(random() * wrong.length)] ?? right)
  const ms = BOT_SHADOWS.pickMs.min + random() * (BOT_SHADOWS.pickMs.max - BOT_SHADOWS.pickMs.min) + step * 150
  return pickMove(spot, ms)
}

/** The longest a round can take on screen, in ms. */
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
  formatScore: (score) => formatShadowScore(score),
  best: { of: (moves, setup) => settle(moves, setup)?.scores[0] ?? null, lowerIsBetter: false, format: formatShadowScore },
}
