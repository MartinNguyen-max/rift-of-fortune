import type { RandomFn } from '../random'

/** Steps on the path, and shrooms the planter hides on it (at most one per step). */
export const PATH_STEPS = 5
export const SHROOM_COUNT = 3
/** Seconds the walker has to pick a side on each step; then they jump to a random side. */
export const STEP_SECONDS = 4
/** A tied game is played again this many times before it is a draw. */
export const MAX_SHROOM_GAMES = 3

export type Side = 'left' | 'right'
export const SIDES: readonly Side[] = ['left', 'right']

/** Where the shrooms are: one entry per step, the side with a shroom or null for a safe step. */
export type ShroomPlan = (Side | null)[]

export const emptyPlan = (): ShroomPlan => Array.from({ length: PATH_STEPS }, () => null)

export const shroomsPlaced = (plan: ShroomPlan): number => plan.filter((side) => side !== null).length

export const isPlanReady = (plan: ShroomPlan): boolean =>
  plan.length === PATH_STEPS && shroomsPlaced(plan) === SHROOM_COUNT

/**
 * Taps a spot while planting: a tap on a shroom removes it, a tap on the other side of a step
 * moves it, and a tap on an empty step adds one while shrooms are left.
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

/** The bot hides its shrooms on random steps and sides. */
export function botPlan(random: RandomFn): ShroomPlan {
  const steps = Array.from({ length: PATH_STEPS }, (_, index) => index)
    .map((index) => ({ index, order: random() }))
    .sort((a, b) => a.order - b.order)
    .slice(0, SHROOM_COUNT)
    .map(({ index }) => index)
  return Array.from({ length: PATH_STEPS }, (_, index) =>
    steps.includes(index) ? (random() < 0.5 ? 'left' : 'right') : null,
  )
}

export const randomSide = (random: RandomFn): Side => (random() < 0.5 ? 'left' : 'right')

/** The bot walks: a coin flip on every step. */
export const botSteps = (random: RandomFn): Side[] => Array.from({ length: PATH_STEPS }, () => randomSide(random))

/** Whoever walked further wins; a tie means another game. */
export function shroomWinner(playerWalk: WalkResult, botWalk: WalkResult): 'player' | 'bot' | 'tie' {
  if (playerWalk.safeSteps === botWalk.safeSteps) return 'tie'
  return playerWalk.safeSteps > botWalk.safeSteps ? 'player' : 'bot'
}
