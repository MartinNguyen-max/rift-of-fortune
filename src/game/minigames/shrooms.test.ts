import { describe, expect, it } from 'vitest'
import { seededRandom } from '../random'
import {
  decodePlan,
  decodeWalk,
  emptyPlan,
  encodePlan,
  encodeWalk,
  isPlanReady,
  PATH_STEPS,
  planterOf,
  randomPlan,
  SHROOM_COUNT,
  SHROOM_RULES,
  toggleShroom,
  walkPath,
  type ShroomPlan,
  type Side,
} from './shrooms'
import { soloSetup, type GameSetup } from './versus'

describe('toggleShroom', () => {
  it('adds, moves and removes shrooms', () => {
    const one = toggleShroom(emptyPlan(), 0, 'up')
    expect(one[0]).toBe('up')
    expect(toggleShroom(one, 0, 'down')[0]).toBe('down')
    expect(toggleShroom(one, 0, 'up')[0]).toBeNull()
  })

  it('allows only SHROOM_COUNT shrooms, one per step', () => {
    let plan = emptyPlan()
    for (let step = 0; step < PATH_STEPS; step++) plan = toggleShroom(plan, step, 'up')
    expect(plan.filter(Boolean)).toHaveLength(SHROOM_COUNT)
    expect(isPlanReady(plan)).toBe(true)
    expect(toggleShroom(plan, 0, 'down')[0]).toBe('down')
  })
})

describe('walkPath', () => {
  const plan: ShroomPlan = ['up', null, 'down', null, 'up']

  it('goes boom on the first shroom stepped on', () => {
    expect(walkPath(plan, ['down', 'up', 'down', 'up', 'down'])).toEqual({ safeSteps: 2, boomAt: 2 })
    expect(walkPath(plan, ['up'])).toEqual({ safeSteps: 0, boomAt: 0 })
  })

  it('makes it across when every step dodges the shrooms', () => {
    expect(walkPath(plan, ['down', 'up', 'up', 'down', 'down'])).toEqual({ safeSteps: PATH_STEPS, boomAt: null })
  })
})

describe('encoding', () => {
  it('packs plans and walks into numbers and back', () => {
    const plan: ShroomPlan = ['up', null, 'down', null, 'up']
    expect(decodePlan(encodePlan(plan))).toEqual(plan)
    const walk: Side[] = ['down', 'up', 'down']
    expect(decodeWalk(encodeWalk(walk))).toEqual(walk)
  })

  it('always gives a ready random plan', () => {
    const random = seededRandom(1)
    for (let game = 0; game < 50; game++) expect(isPlanReady(randomPlan(random))).toBe(true)
  })
})

describe('SHROOM_RULES', () => {
  const plan = encodePlan(['up', 'up', 'up', null, null])
  const safe = encodeWalk(['down', 'down', 'down', 'down', 'down'])
  const boom = encodeWalk(['up'])

  it('solo: you plant first, then the bot plants for you; furthest walk wins', () => {
    const setup = soloSetup(3)
    expect(planterOf(0, setup)).toBe(0)
    expect(planterOf(1, setup)).toBe(1)
    // Half 0: you plant, the bot walks (boom at once). Half 1: the bot plants, you walk across.
    expect(SHROOM_RULES.settle([[plan, safe], [boom, plan]], setup)).toEqual({ winner: 0, scores: [5, 0] })
  })

  it('solo: the bot walks only after you planted', () => {
    const setup = soloSetup(3)
    expect(SHROOM_RULES.botMove(0, [[], []], setup)).toBeUndefined()
    expect(SHROOM_RULES.botMove(0, [[plan], []], setup)).toBeTypeOf('number')
  })

  it('Multiplayer with one role each: the walker wins by getting 3 steps far', () => {
    const setup: GameSetup = { seed: 5, variant: 'live', bothRoles: false, late: false }
    const planter = planterOf(0, setup)
    const moves: [number[], number[]] = [[], []]
    moves[planter] = [plan]
    moves[planter === 0 ? 1 : 0] = [safe]
    expect(SHROOM_RULES.settle(moves, setup)?.winner).toBe(planter === 0 ? 1 : 0)
    expect(SHROOM_RULES.owed([[], []], setup)).toEqual([{ player: planter, step: 0 }])
  })
})
