import { describe, expect, it } from 'vitest'
import { seededRandom } from '../random'
import {
  botPlan,
  botSteps,
  emptyPlan,
  isPlanReady,
  PATH_STEPS,
  SHROOM_COUNT,
  shroomWinner,
  toggleShroom,
  walkPath,
  type ShroomPlan,
} from './shrooms'

describe('toggleShroom', () => {
  it('adds, moves and removes shrooms', () => {
    const one = toggleShroom(emptyPlan(), 0, 'left')
    expect(one[0]).toBe('left')
    expect(toggleShroom(one, 0, 'right')[0]).toBe('right')
    expect(toggleShroom(one, 0, 'left')[0]).toBeNull()
  })

  it('allows only SHROOM_COUNT shrooms, but moving one is still fine', () => {
    let plan = emptyPlan()
    for (let step = 0; step < PATH_STEPS; step++) plan = toggleShroom(plan, step, 'left')
    expect(plan.filter(Boolean)).toHaveLength(SHROOM_COUNT)
    expect(isPlanReady(plan)).toBe(true)
    expect(toggleShroom(plan, 0, 'right')[0]).toBe('right')
  })
})

describe('walkPath', () => {
  const plan: ShroomPlan = ['left', null, 'right', null, 'left']

  it('goes boom on the first shroom stepped on', () => {
    expect(walkPath(plan, ['right', 'left', 'right', 'left', 'right'])).toEqual({ safeSteps: 2, boomAt: 2 })
    expect(walkPath(plan, ['left'])).toEqual({ safeSteps: 0, boomAt: 0 })
  })

  it('makes it across when every step dodges the shrooms', () => {
    expect(walkPath(plan, ['right', 'left', 'left', 'right', 'right'])).toEqual({ safeSteps: PATH_STEPS, boomAt: null })
  })
})

describe('bot', () => {
  it('always plants exactly SHROOM_COUNT shrooms', () => {
    const random = seededRandom(1)
    for (let game = 0; game < 50; game++) expect(isPlanReady(botPlan(random))).toBe(true)
  })

  it('walks one side per step', () => {
    expect(botSteps(seededRandom(2))).toHaveLength(PATH_STEPS)
  })
})

describe('shroomWinner', () => {
  it('rewards the walker who got further and calls a tie on equal steps', () => {
    expect(shroomWinner({ safeSteps: 3, boomAt: 3 }, { safeSteps: 1, boomAt: 1 })).toBe('player')
    expect(shroomWinner({ safeSteps: 0, boomAt: 0 }, { safeSteps: 5, boomAt: null })).toBe('bot')
    expect(shroomWinner({ safeSteps: 2, boomAt: 2 }, { safeSteps: 2, boomAt: 2 })).toBe('tie')
  })
})
