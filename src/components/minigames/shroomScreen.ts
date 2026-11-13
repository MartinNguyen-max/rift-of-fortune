import { useEffect, useRef, useState } from 'react'
import { PATH_STEPS, randomSide, SHROOM_COUNT, shroomsPlaced, type ShroomPlan, type Side } from '../../game/minigames/shrooms'
import { stepSeed, type GameSetup } from '../../game/minigames/versus'
import { sample, seededRandom, type RandomFn } from '../../game/random'

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

/** Only the shrooms that went off: what a walker has found out so far. */
export const revealedShrooms = (plan: ShroomPlan, booms: readonly number[]): ShroomPlan =>
  plan.map((side, step) => (booms.includes(step) ? side : null))

/**
 * Steps on show when you watch someone walk: one hop at a time, at most one per `hopMs`. Steps
 * that come in live show as soon as they arrive; a walk that arrives in one piece (the bot, or a
 * reconnect) plays hop by hop. Your own steps show at once.
 */
export function useHops(available: number, instant: boolean, hopMs: number): number {
  const [shown, setShown] = useState(0)
  const lastHop = useRef(-Infinity)
  useEffect(() => {
    if (instant || shown >= available) return
    const wait = Math.max(0, hopMs - (performance.now() - lastHop.current))
    const id = window.setTimeout(() => {
      lastHop.current = performance.now()
      setShown(shown + 1)
    }, wait)
    return () => window.clearTimeout(id)
  }, [available, instant, shown, hopMs])
  return instant ? available : Math.min(shown, available)
}

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
