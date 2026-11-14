import { seededRandom, type RandomFn } from '../random'
import { stepSeed, type BothMoves, type GameSetup, type MiniGameRules, type Owed, type Player, type Settled } from './versus'

/**
 * Tahm Kench, Devour: Jinx fires her Super Mega Death Rocket across the map at your carry, and it
 * speeds up as it flies. Tap Devour so the carry is inside Tahm when it lands. Devour only holds
 * them for a moment: too early and he spits them out before the impact, too late and they are
 * dead. The closer to the impact, the more points. Three rockets, each with its own wind-up,
 * flight time and boost, so no rhythm carries over.
 *
 * A move is the time of the Devour in ms since the round started, or NO_DEVOUR.
 */
export const DEVOUR = {
  rockets: 3,
  /** How long the carry stays safe inside Tahm, in ms. */
  safeMs: 800,
  /** Jinx winds up before she fires, in ms. */
  windUpMs: { min: 700, max: 1800 },
  /** The rocket's flight from Jinx to the carry, in ms. */
  flightMs: { min: 1500, max: 2900 },
  /** How hard the rocket speeds up: its progress is (time share)^boost. */
  boost: { min: 1.5, max: 2.6 },
  /** A Devour this close before the impact scores the full 100. */
  perfectMs: 60,
  /** A Devour right at the start of the safe window still scores this much. */
  minPoints: 30,
  /** After the impact, the round waits this long for a press before it counts as none. */
  graceMs: 500,
} as const

/** A move for a player who never pressed: far after any impact, so it is too late. */
export const NO_DEVOUR = 60_000

/** Carries Jinx's rocket goes for: each round saves a different one. */
export const DEVOUR_ALLIES = ['Ezreal', 'Lux', 'Ashe', 'Caitlyn', 'Sona', 'Seraphine', 'Kaisa', 'MissFortune'] as const

export interface Rocket {
  /** The carry Tahm has to save. */
  ally: string
  windUpMs: number
  flightMs: number
  boost: number
}

const between = (min: number, max: number, random: RandomFn) => min + random() * (max - min)

/** The three rockets of a game, the same for both players, each going for a different carry. */
export function devourRockets(seed: number): Rocket[] {
  const random = seededRandom(stepSeed(seed, 0, 71))
  const allies: string[] = [...DEVOUR_ALLIES]
  return Array.from({ length: DEVOUR.rockets }, () => {
    const [ally = 'Ezreal'] = allies.splice(Math.floor(random() * allies.length), 1)
    return {
      ally,
      windUpMs: Math.round(between(DEVOUR.windUpMs.min, DEVOUR.windUpMs.max, random)),
      flightMs: Math.round(between(DEVOUR.flightMs.min, DEVOUR.flightMs.max, random)),
      boost: between(DEVOUR.boost.min, DEVOUR.boost.max, random),
    }
  })
}

/** When the rocket lands, in ms since the round started. */
export const impactMs = (rocket: Rocket): number => rocket.windUpMs + rocket.flightMs

/** How far the rocket has flown at `ms` since the round started: 0 at Jinx, 1 at the carry. */
export function rocketProgress(rocket: Rocket, ms: number): number {
  const share = (ms - rocket.windUpMs) / rocket.flightMs
  if (share <= 0) return 0
  if (share >= 1) return 1
  return share ** rocket.boost
}

export type DevourOutcome = 'perfect' | 'saved' | 'early' | 'late'

export interface DevourResult {
  outcome: DevourOutcome
  points: number
  /** ms from the Devour to the impact (negative: after it), or null without a press. */
  margin: number | null
}

/** The carry is safe if the impact comes while they are inside Tahm. Closer to the impact scores more. */
export function devourResult(rocket: Rocket, move: number): DevourResult {
  if (move >= NO_DEVOUR) return { outcome: 'late', points: 0, margin: null }
  const margin = impactMs(rocket) - move
  if (margin < 0) return { outcome: 'late', points: 0, margin }
  if (margin > DEVOUR.safeMs) return { outcome: 'early', points: 0, margin }
  if (margin <= DEVOUR.perfectMs) return { outcome: 'perfect', points: 100, margin }
  const share = (margin - DEVOUR.perfectMs) / (DEVOUR.safeMs - DEVOUR.perfectMs)
  return { outcome: 'saved', points: Math.round(100 - share * (100 - DEVOUR.minPoints)), margin }
}

/** Each player's points per rocket played so far. */
export function devourPoints(moves: BothMoves, seed: number): [number[], number[]] {
  const rockets = devourRockets(seed)
  const points: [number[], number[]] = [[], []]
  for (const [step, rocket] of rockets.entries()) {
    for (const player of [0, 1] as const) {
      const move = moves[player][step]
      if (move !== undefined) points[player].push(devourResult(rocket, move).points)
    }
  }
  return points
}

const total = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0)

function settle(moves: BothMoves, { seed }: GameSetup): Settled | null {
  const [mine, theirs] = devourPoints(moves, seed)
  if (mine.length < DEVOUR.rockets || theirs.length < DEVOUR.rockets) return null
  const scores: [number, number] = [total(mine), total(theirs)]
  const winner: Player | null = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1
  return { winner, scores }
}

function owed(moves: BothMoves): Owed[] {
  return ([0, 1] as const).flatMap((player) => {
    const missing = moves[player].findIndex((move) => move === undefined)
    const next = missing === -1 ? moves[player].length : missing
    return next < DEVOUR.rockets ? [{ player, step: next }] : []
  })
}

/**
 * Yuumi, the bot: she aims for about 0.25 s before the impact and is off by up to 0.33 s either
 * way, so she is too early or too late now and then. Sometimes she panics and jumps far too
 * early. About 60 points a rocket.
 */
export const BOT_DEVOUR = { aimMs: 250, errorMs: 330, panicChance: 0.08 } as const

export function botDevour(seed: number, step: number): number | undefined {
  const rocket = devourRockets(seed)[step]
  if (!rocket) return undefined
  const random = seededRandom(stepSeed(seed, step, 73))
  const panic = random() < BOT_DEVOUR.panicChance
  const margin = panic ? DEVOUR.safeMs + 150 + random() * 400 : BOT_DEVOUR.aimMs + (random() * 2 - 1) * BOT_DEVOUR.errorMs
  return Math.max(0, Math.round(impactMs(rocket) - margin))
}

/** The longest a round can take: the longest wind-up and flight, then the grace for a late press. */
const longestRoundMs = DEVOUR.windUpMs.max + DEVOUR.flightMs.max + DEVOUR.graceMs

export const DEVOUR_RULES: MiniGameRules = {
  chances: 1,
  // A 3-2-1, three rockets with a pause to see each result, and a moment at the end.
  liveSeconds: () => Math.ceil(3 + (DEVOUR.rockets * (longestRoundMs + 2600)) / 1000 + 3),
  owed,
  settle,
  fallback: () => NO_DEVOUR,
  botMove: (step, _moves, { seed }) => botDevour(seed, step),
  formatScore: (score) => `${score} pts`,
  best: { of: (moves, setup) => settle(moves, setup)?.scores[0] ?? null, lowerIsBetter: false, format: (score) => `${score} pts` },
}
