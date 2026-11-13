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
  /** Steps that went boom, in order. The walker keeps walking after a boom. */
  booms: number[]
  /** Shrooms passed on the other lane. */
  dodged: number
}

/** Walks the steps taken so far: every shroom stepped on goes boom, every other one passed is dodged. */
export function walkPath(plan: ShroomPlan, steps: readonly Side[]): WalkResult {
  const booms: number[] = []
  let dodged = 0
  steps.slice(0, PATH_STEPS).forEach((side, step) => {
    const shroom = plan[step]
    if (shroom === side) booms.push(step)
    else if (shroom) dodged += 1
  })
  return { booms, dodged }
}

/** Points from one walk: a point to the planter for each boom, a point to the walker for each dodge. */
export const walkPoints = (walk: WalkResult) => ({ planter: walk.booms.length, walker: walk.dodged })

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

// ── Moves ────────────────────────────────────────────────────────
// A plan is one move (packed). A walk is one move per step, so the planter can watch it live.

const SIDE_DIGIT: Record<Side, number> = { up: 1, down: 2 }
const DIGIT_SIDE: Record<number, Side | undefined> = { 1: 'up', 2: 'down' }

export const encodePlan = (plan: ShroomPlan): number => packDigits(plan.map((side) => (side ? SIDE_DIGIT[side] : 0)))

/** A plan from a move. Never more than SHROOM_COUNT shrooms, whatever came over the network. */
export function decodePlan(value: number): ShroomPlan {
  let left = SHROOM_COUNT
  return unpackDigits(value, PATH_STEPS).map((digit) => {
    const side = DIGIT_SIDE[digit] ?? null
    if (!side || left === 0) return null
    left -= 1
    return side
  })
}

export const encodeStep = (side: Side): number => SIDE_DIGIT[side]
export const decodeStep = (value: number): Side => DIGIT_SIDE[value] ?? 'down'

/**
 * Halves: in each half one player plants and the other walks. In half h, the planter is the first
 * player for even h and the other one for odd h.
 */
export function planterOf(half: number, setup: GameSetup): Player {
  const first = firstPlayer(setup)
  return half % 2 === 0 ? first : other(first)
}

/** How many halves can be played: solo replays ties, Multiplayer plays one or two. */
export const maxHalves = (setup: GameSetup): number => (setup.variant === 'solo' ? MAX_SHROOM_GAMES * 2 : setup.bothRoles ? 2 : 1)

/** Moves a player makes in a half: one plan, or one per step of the walk. */
const movesIn = (half: number, player: Player, setup: GameSetup) => (planterOf(half, setup) === player ? 1 : PATH_STEPS)

/** Where a player's moves for a half start. Each player's moves follow on without gaps. */
export function slotOf(half: number, player: Player, setup: GameSetup): number {
  let slot = 0
  for (let earlier = 0; earlier < half; earlier++) slot += movesIn(earlier, player, setup)
  return slot
}

/** The half and the place in it of one of a player's moves. */
function locate(step: number, player: Player, setup: GameSetup): { half: number; offset: number } | null {
  let start = 0
  for (let half = 0; half < maxHalves(setup); half++) {
    const size = movesIn(half, player, setup)
    if (step < start + size) return { half, offset: step - start }
    start += size
  }
  return null
}

export interface HalfMoves {
  planter: Player
  walker: Player
  /** The planted shrooms, once sent. */
  plan: ShroomPlan | null
  /** The lanes walked so far, in order. */
  steps: Side[]
}

/** What has been played of one half: the plan and the walk so far. */
export function halfMoves(moves: BothMoves, setup: GameSetup, half: number): HalfMoves {
  const planter = planterOf(half, setup)
  const walker = other(planter)
  const planMove = moves[planter][slotOf(half, planter, setup)]
  const start = slotOf(half, walker, setup)
  const steps: Side[] = []
  for (let step = 0; step < PATH_STEPS; step++) {
    const move = moves[walker][start + step]
    if (move === undefined) break
    steps.push(decodeStep(move))
  }
  return { planter, walker, plan: planMove === undefined ? null : decodePlan(planMove), steps }
}

export interface HalfResult {
  walker: Player
  walk: WalkResult
}

/** Every finished half (planted and walked all the way): who walked and how it went. */
export function halfResults(moves: BothMoves, setup: GameSetup): HalfResult[] {
  const results: HalfResult[] = []
  for (let half = 0; half < maxHalves(setup); half++) {
    const { walker, plan, steps } = halfMoves(moves, setup, half)
    if (!plan || steps.length < PATH_STEPS) break
    results.push({ walker, walk: walkPath(plan, steps) })
  }
  return results
}

/** Each player's points from some walks. */
export function pointsOf(results: readonly HalfResult[]): [number, number] {
  const points: [number, number] = [0, 0]
  for (const { walker, walk } of results) {
    const { planter, walker: walkerPoints } = walkPoints(walk)
    points[other(walker)] += planter
    points[walker] += walkerPoints
  }
  return points
}

/**
 * One role each (Multiplayer): the one walk decides, 3 points in all, so 2 booms win it for the
 * planter. Otherwise the halves come in pairs, each player planting and walking once; the first
 * pair with more points for one player decides (solo replays a tied pair, Multiplayer flips a coin).
 */
function settle(moves: BothMoves, setup: GameSetup): Settled | null {
  const results = halfResults(moves, setup)
  const halvesPerGame = setup.variant === 'live' && !setup.bothRoles ? 1 : 2
  for (let game = 0; (game + 1) * halvesPerGame <= results.length; game++) {
    const scores = pointsOf(results.slice(game * halvesPerGame, (game + 1) * halvesPerGame))
    const last = (game + 1) * halvesPerGame >= maxHalves(setup)
    if (scores[0] !== scores[1]) return { winner: scores[0] > scores[1] ? 0 : 1, scores }
    if (last) return { winner: null, scores }
  }
  return null
}

function owed(moves: BothMoves, setup: GameSetup): Owed[] {
  if (settle(moves, setup)) return []
  const half = halfResults(moves, setup).length
  if (half >= maxHalves(setup)) return []
  const { planter, walker, plan, steps } = halfMoves(moves, setup, half)
  // The walker can only walk once the shrooms are planted.
  if (!plan) return [{ player: planter, step: slotOf(half, planter, setup) }]
  return [{ player: walker, step: slotOf(half, walker, setup) + steps.length }]
}

/** A missing step from a walker who never answered: always onto the shroom, if there is one. */
function poorStep(moves: BothMoves, setup: GameSetup, half: number, step: number): Side {
  return halfMoves(moves, setup, half).plan?.[step] ?? 'up'
}

export const SHROOM_RULES: MiniGameRules = {
  chances: 2,
  liveSeconds: (setup) => (setup.bothRoles ? 2 : 1) * (PLANT_SECONDS + PATH_STEPS * STEP_SECONDS.live + 8),
  owed,
  settle,
  fallback: ({ player, step }, moves, setup) => {
    const at = locate(step, player, setup)
    if (!at) return 0
    if (planterOf(at.half, setup) === player) return encodePlan(randomPlan(seededRandom(stepSeed(setup.seed, at.half, player + 11))))
    return encodeStep(poorStep(moves, setup, at.half, at.offset))
  },
  botMove: (step, moves, setup) => {
    const at = locate(step, 1, setup)
    if (!at || settle(moves, setup)) return undefined
    if (planterOf(at.half, setup) === 1) return encodePlan(randomPlan(seededRandom(stepSeed(setup.seed, at.half, 23))))
    // The bot walks once the player has planted: a coin flip on every step.
    if (!halfMoves(moves, setup, at.half).plan) return undefined
    return encodeStep(randomSide(seededRandom(stepSeed(setup.seed, at.half * PATH_STEPS + at.offset, 29))))
  },
  formatScore: (points) => `${points} ${points === 1 ? 'point' : 'points'}`,
  best: {
    of: (moves, setup) => settle(moves, setup)?.scores[0] ?? null,
    lowerIsBetter: false,
    format: (points) => `${points} points`,
  },
}
