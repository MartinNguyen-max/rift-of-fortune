import { useEffect } from 'react'
import {
  PATH_STEPS,
  randomSide,
  SHROOM_COUNT,
  shroomsPlaced,
  walkPath,
  type ShroomPlan,
  type Side,
} from '../../game/minigames/shrooms'
import { stepSeed, type GameSetup } from '../../game/minigames/versus'
import { sample, seededRandom, type RandomFn } from '../../game/random'

/**
 * The part of a walk worth showing: up to the boom, or until the walker is through. A bot's or a
 * host's walk has a lane for every step, even after a boom.
 */
export function walkToShow(plan: ShroomPlan, steps: readonly Side[], stepsToGo: number): Side[] {
  const { boomAt } = walkPath(plan, steps)
  return steps.slice(0, Math.min(stepsToGo, boomAt === null ? steps.length : boomAt + 1))
}

/** A planter out of time keeps their shrooms; the missing ones go on random free columns. */
export function fillPlan(plan: ShroomPlan, random: RandomFn): ShroomPlan {
  const missing = SHROOM_COUNT - shroomsPlaced(plan)
  if (missing <= 0) return plan
  const freeSteps = plan.flatMap((side, step) => (side === null ? [step] : []))
  const picked = sample(freeSteps, missing, random)
  return plan.map((side, step) => (picked.includes(step) ? randomSide(random) : side))
}

/** The plan a planter out of time ends up with: the same for everyone, so render stays pure. */
export const timeoutPlan = (plan: ShroomPlan, setup: GameSetup, half: number): ShroomPlan =>
  fillPlan(plan, seededRandom(stepSeed(setup.seed, half, 73)))

/** The lane a walker out of time jumps to on a step. */
export const timeoutSide = (setup: GameSetup, half: number, step: number): Side =>
  randomSide(seededRandom(stepSeed(setup.seed, half * PATH_STEPS + step, 71)))

const KEY_SIDES: Record<string, Side | undefined> = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' }

/** ↑ or W steps on the top lane, ↓ or S on the bottom one. */
export function useLaneKeys(onSide: (side: Side) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      const side = KEY_SIDES[event.code]
      if (!side || event.repeat) return
      event.preventDefault()
      onSide(side)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSide, enabled])
}
