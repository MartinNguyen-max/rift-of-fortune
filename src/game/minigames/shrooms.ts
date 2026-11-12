import { seededRandom, type RandomFn } from '../random'
import {
  firstPlayer,
  other,
  packDigits,
  stepSeed,
  unpackDigits,
  type BothMoves,
  type GameSetup,
  type MiniGameRules,
  type Owed,
  type Player,
  type Settled,
} from './versus'

/** Steps on the path (left to right), and shrooms the planter hides on it (at most one per step). */
export const PATH_STEPS = 5
export const SHROOM_COUNT = 3
/** Seconds the walker has to pick a lane on each step; then they jump to a random one. */
export const STEP_SECONDS = { solo: 4, live: 3 } as const
/** Seconds to plant. */
export const PLANT_SECONDS = 15
/** Solo: a tied game is played again this many times before it is a draw. */
export const MAX_SHROOM_GAMES = 3
/** Multiplayer with one role each: the walker wins by getting this far. */
export const WALKER_GOAL = 3

/** The two lanes of the path. */
export type Side = 'up' | 'down'
export const SIDES: readonly Side[] = ['up', 'down']

/** Where the shrooms are: one entry per step, the lane with a shroom or null for a safe step. */
export type ShroomPlan = (Side | null)[]

export const emptyPlan = (): ShroomPlan => Array.from({ length: PATH_STEPS }, () => null)

export const shroomsPlaced = (plan: ShroomPlan): number => plan.filter((side) => side !== null).length

export const isPlanReady = (plan: ShroomPlan): boolean =>
  plan.length === PATH_STEPS && shroomsPlaced(plan) === SHROOM_COUNT

/**
 * Taps a spot while planting: a tap on a shroom removes it, a tap on the other lane of a step
 * moves it there (one shroom per step), and a tap on an empty step adds one while shrooms are left.
 */
export function toggleShroom(plan: ShroomPlan, step: number, side: Side): ShroomPlan {
  const current = plan[step]
  if (current === side) return plan.map((value, index) => (index === step ? null : value))
  if (current === undefined) return plan
  if (current === null && shroomsPlaced(plan) >= SHROOM_COUNT) return plan
  return plan.map((value, index) => (index === step ? side : value))
}

export interface WalkResult {
  /** Steps taken safely. PATH_STEPS means the walker made it across. */
  safeSteps: number
  /** The step that went boom, or null. */
  boomAt: number | null
}

/** Walks the path one step at a time until a shroom goes off. */
export function walkPath(plan: ShroomPlan, steps: readonly Side[]): WalkResult {
  for (let index = 0; index < steps.length && index < PATH_STEPS; index++) {
    if (plan[index] === steps[index]) return { safeSteps: index, boomAt: index }
  }
  return { safeSteps: Math.min(steps.length, PATH_STEPS), boomAt: null }
}

/** The bot (or a planter who ran out of time) hides its shrooms on random steps and lanes. */
export function randomPlan(random: RandomFn): ShroomPlan {
  const steps = Array.from({ length: PATH_STEPS }, (_, index) => index)
    .map((index) => ({ index, order: random() }))
    .sort((a, b) => a.order - b.order)
    .slice(0, SHROOM_COUNT)
    .map(({ index }) => index)
  return Array.from({ length: PATH_STEPS }, (_, index) => (steps.includes(index) ? randomSide(random) : null))
}

export const randomSide = (random: RandomFn): Side => (random() < 0.5 ? 'up' : 'down')

/** A random walk: a coin flip on every step. */
export const randomSteps = (random: RandomFn): Side[] => Array.from({ length: PATH_STEPS }, () => randomSide(random))

// ── Moves: plans and walks packed into whole numbers ─────────────

const SIDE_DIGIT: Record<Side, number> = { up: 1, down: 2 }
const DIGIT_SIDE: Record<number, Side | undefined> = { 1: 'up', 2: 'down' }

export const encodePlan = (plan: ShroomPlan): number => packDigits(plan.map((side) => (side ? SIDE_DIGIT[side] : 0)))
export const decodePlan = (value: number): ShroomPlan => unpackDigits(value, PATH_STEPS).map((digit) => DIGIT_SIDE[digit] ?? null)

/** A walk is the lanes stepped on, in order; it ends at the first boom. */
export const encodeWalk = (steps: readonly Side[]): number => packDigits(steps.map((side) => SIDE_DIGIT[side]))
export function decodeWalk(value: number): Side[] {
  const steps: Side[] = []
  for (const digit of unpackDigits(value, PATH_STEPS)) {
    const side = DIGIT_SIDE[digit]
    if (!side) break
    steps.push(side)
  }
  return steps
}

/**
 * Halves: in each half one player plants and the other walks. In half h, the planter is the first
 * player for even h and the other one for odd h. A player's move h is their plan or their walk.
 */
export function planterOf(half: number, setup: GameSetup): Player {
  const first = firstPlayer(setup)
  return half % 2 === 0 ? first : other(first)
}

/** How many halves can be played: solo replays ties, Multiplayer plays one or two. */
const maxHalves = (setup: GameSetup) => (setup.variant === 'solo' ? MAX_SHROOM_GAMES * 2 : setup.bothRoles ? 2 : 1)

/** The walk in each finished half: who walked and how far. */
export function halfResults(moves: BothMoves, setup: GameSetup): { walker: Player; walk: WalkResult }[] {
  const results: { walker: Player; walk: WalkResult }[] = []
  for (let half = 0; half < maxHalves(setup); half++) {
    const planter = planterOf(half, setup)
    const walker = other(planter)
    const plan = moves[planter][half]
    const walk = moves[walker][half]
    if (plan === undefined || walk === undefined) break
    results.push({ walker, walk: walkPath(decodePlan(plan), decodeWalk(walk)) })
  }
  return results
}

function settle(moves: BothMoves, setup: GameSetup): Settled | null {
  const results = halfResults(moves, setup)
  if (setup.variant === 'live' && !setup.bothRoles) {
    const [half] = results
    if (!half) return null
    const steps = half.walk.safeSteps
    const scores: [number, number] = [0, 0]
    scores[half.walker] = steps
    return { winner: steps >= WALKER_GOAL ? half.walker : other(half.walker), scores }
  }
  // Pairs of halves: each player walks once per pair; the first pair that isn't a tie decides.
  for (let pair = 0; pair * 2 + 1 < results.length; pair++) {
    const scores: [number, number] = [0, 0]
    for (const { walker, walk } of results.slice(pair * 2, pair * 2 + 2)) scores[walker] = walk.safeSteps
    const lastPair = (pair + 1) * 2 >= maxHalves(setup)
    if (scores[0] !== scores[1]) return { winner: scores[0] > scores[1] ? 0 : 1, scores }
    if (lastPair) return { winner: null, scores }
  }
  return null
}

function owed(moves: BothMoves, setup: GameSetup): Owed[] {
  if (settle(moves, setup)) return []
  const half = halfResults(moves, setup).length
  const planter = planterOf(half, setup)
  // The walker can only walk once the shrooms are planted.
  if (moves[planter][half] === undefined) return [{ player: planter, step: half }]
  return [{ player: other(planter), step: half }]
}

export const SHROOM_RULES: MiniGameRules = {
  chances: 2,
  liveSeconds: (setup) => (setup.bothRoles ? 2 : 1) * (PLANT_SECONDS + PATH_STEPS * STEP_SECONDS.live + 6),
  owed,
  settle,
  fallback: ({ player, step }, _moves, setup) => {
    const random = seededRandom(stepSeed(setup.seed, step, player + 11))
    return planterOf(step, setup) === player ? encodePlan(randomPlan(random)) : encodeWalk(randomSteps(random))
  },
  botMove: (step, moves, setup) => {
    if (step >= maxHalves(setup) || settle(moves, setup)) return undefined
    const random = seededRandom(stepSeed(setup.seed, step, 23))
    if (planterOf(step, setup) === 1) return encodePlan(randomPlan(random))
    // The bot walks once the player has planted.
    return moves[0][step] === undefined ? undefined : encodeWalk(randomSteps(random))
  },
  formatScore: (steps) => `${steps} / ${PATH_STEPS} steps`,
}
