import { seededRandom } from '../random'
import { stepSeed, type BothMoves, type GameSetup, type MiniGameRules, type Owed, type Player, type Settled } from './versus'

/**
 * The teamfight ult: a marker sweeps back and forth over a bar, faster each second.
 * Stop it as close to the middle of the zone as you can. `seconds` is the time limit.
 */
export const ULT = {
  seconds: 9,
  /** Bar lengths per second at the start, and how much faster it gets each second. */
  speed: { min: 1.45, max: 1.75 },
  acceleration: 0.35,
  /** Where the marker starts, so it is never stuck at the very edge. */
  start: 0.08,
} as const

/**
 * Score bands around the zone's middle, as half-widths (share of the bar), shown on the bar.
 * Inside `perfect` scores 100; from there the score drops smoothly to `min.score` at `min.distance`.
 * Any press scores at least `min.score`, so a duel is rarely decided at 0–0.
 */
export const ULT_ZONES = {
  perfect: 0.022,
  great: 0.06,
  good: 0.12,
  min: { distance: 0.4, score: 10 },
} as const

export interface UltBar {
  /** Middle of the zone, 0–1 along the bar. */
  zoneCenter: number
  speed: number
}

export function ultBar(seed: number): UltBar {
  const random = seededRandom(seed)
  const zoneCenter = 0.3 + random() * 0.4
  const speed = ULT.speed.min + random() * (ULT.speed.max - ULT.speed.min)
  return { zoneCenter, speed }
}

/** The marker's position (0–1) at `seconds`: it starts near the left and bounces off both ends. */
export function markerAt(bar: UltBar, seconds: number): number {
  const distance = ULT.start + bar.speed * seconds + (ULT.acceleration * bar.speed * seconds * seconds) / 2
  const lap = distance % 2
  return lap <= 1 ? lap : 2 - lap
}

/** 100 in the perfect band, then smoothly less the further off; 0 only without a press in time. */
export function ultScore(bar: UltBar, seconds: number | null): number {
  if (seconds === null || seconds > ULT.seconds) return 0
  const distance = Math.abs(markerAt(bar, seconds) - bar.zoneCenter)
  if (distance <= ULT_ZONES.perfect) return 100
  const { min } = ULT_ZONES
  const share = (distance - ULT_ZONES.perfect) / (min.distance - ULT_ZONES.perfect)
  return Math.max(min.score, Math.round(100 - share * (100 - min.score)))
}

// ── The mini-game: moves are press times ─────────────────────────

/** A move for a player who never pressed (in ms): after the time limit, so it scores 0. */
export const NO_PRESS = ULT.seconds * 1000 + 1000

/** Bars per game: solo plays three and adds them up, Multiplayer plays one. */
export const ultBars = (setup: GameSetup): number => (setup.variant === 'solo' ? 3 : 1)

/** The bar for one step of the game. */
export const barOfStep = (setup: GameSetup, step: number): UltBar => ultBar(stepSeed(setup.seed, step, 41))

/** A press move (ms from the start of the bar) as a score. */
export const ultScoreOfMove = (bar: UltBar, move: number): number => ultScore(bar, move >= NO_PRESS ? null : move / 1000)

/** The moments the marker passes the middle of the zone, in seconds. */
export function zoneCrossings(bar: UltBar): number[] {
  const crossings: number[] = []
  const step = 0.002
  for (let time = step; time < ULT.seconds; time += step) {
    const before = markerAt(bar, time - step) - bar.zoneCenter
    const after = markerAt(bar, time) - bar.zoneCenter
    if (before * after <= 0) crossings.push(time)
  }
  return crossings
}

/** The bot waits for one of the first passes over the zone and presses a little early or late. */
export const BOT_ULT = { error: 0.12 } as const

export function botPress(bar: UltBar, seed: number): number {
  const random = seededRandom(seed ^ 0x1b873593)
  const crossings = zoneCrossings(bar)
  const target = crossings[Math.floor(random() * Math.min(3, crossings.length))] ?? ULT.seconds / 2
  const offset = (random() * 2 - 1) * BOT_ULT.error
  return Math.round(Math.max(0, target + offset) * 1000)
}

/** Each player's score per bar played so far. */
export function ultScores(moves: BothMoves, setup: GameSetup): [number[], number[]] {
  const scores: [number[], number[]] = [[], []]
  for (let step = 0; step < ultBars(setup); step++) {
    const bar = barOfStep(setup, step)
    for (const player of [0, 1] as const) {
      const move = moves[player][step]
      if (move !== undefined) scores[player].push(ultScoreOfMove(bar, move))
    }
  }
  return scores
}

const total = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0)

function settle(moves: BothMoves, setup: GameSetup): Settled | null {
  const bars = ultBars(setup)
  const [mine, theirs] = ultScores(moves, setup)
  if (mine.length < bars || theirs.length < bars) return null
  const scores: [number, number] = [total(mine), total(theirs)]
  const winner: Player | null = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1
  return { winner, scores }
}

function owed(moves: BothMoves, setup: GameSetup): Owed[] {
  return ([0, 1] as const).flatMap((player) => {
    const missing = moves[player].findIndex((move) => move === undefined)
    const next = missing === -1 ? moves[player].length : missing
    return next < ultBars(setup) ? [{ player, step: next }] : []
  })
}

export const ULT_RULES: MiniGameRules = {
  chances: 1,
  // A 3-2-1, the bar, and a moment to see the result.
  liveSeconds: () => 3 + ULT.seconds + 3,
  owed,
  settle,
  fallback: () => NO_PRESS,
  botMove: (step, _moves, setup) => (step < ultBars(setup) ? botPress(barOfStep(setup, step), stepSeed(setup.seed, step, 43)) : undefined),
  formatScore: (score) => `${score} pts`,
  best: { of: (moves, setup) => settle(moves, setup)?.scores[0] ?? null, lowerIsBetter: false, format: (score) => `${score} pts` },
}
