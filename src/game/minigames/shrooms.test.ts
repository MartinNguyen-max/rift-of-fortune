import { describe, expect, it } from 'vitest'
import { seededRandom } from '../random'
import {
  decodePlan,
  decodeStep,
  emptyPlan,
  encodePlan,
  encodeStep,
  halfMoves,
  halfResults,
  isPlanReady,
  PATH_STEPS,
  planterOf,
  randomPlan,
  SHROOM_COUNT,
  SHROOM_RULES,
  slotOf,
  toggleShroom,
  walkPath,
  type ShroomPlan,
  type Side,
} from './shrooms'
import { botMoves, other, soloSetup, type GameSetup, type Player } from './versus'

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

  it('counts every shroom stepped on and keeps walking', () => {
    expect(walkPath(plan, ['up', 'up', 'down', 'up', 'up'])).toEqual({ booms: [0, 2, 4], dodged: 0 })
    expect(walkPath(plan, ['down', 'up', 'down', 'up', 'down'])).toEqual({ booms: [2], dodged: 2 })
  })

  it('counts a shroom passed on the other lane as dodged', () => {
    expect(walkPath(plan, ['down', 'up', 'up', 'down', 'down'])).toEqual({ booms: [], dodged: 3 })
    expect(walkPath(plan, ['down'])).toEqual({ booms: [], dodged: 1 })
  })
})

describe('encoding', () => {
  it('packs plans and steps into numbers and back', () => {
    const plan: ShroomPlan = ['up', null, 'down', null, 'up']
    expect(decodePlan(encodePlan(plan))).toEqual(plan)
    const steps: Side[] = ['down', 'up']
    expect(steps.map(encodeStep).map(decodeStep)).toEqual(steps)
  })

  it('never decodes more than 3 shrooms, whatever comes over the network', () => {
    expect(decodePlan(encodePlan(['up', 'up', 'up', 'up', 'up'])).filter(Boolean)).toHaveLength(SHROOM_COUNT)
  })

  it('always gives a ready random plan', () => {
    const random = seededRandom(1)
    for (let game = 0; game < 50; game++) expect(isPlanReady(randomPlan(random))).toBe(true)
  })
})

/** Builds both players' moves from halves of [plan, walk], in the order they are played. */
function playHalves(setup: GameSetup, halves: readonly [ShroomPlan, Side[]][]): [number[], number[]] {
  const moves: [number[], number[]] = [[], []]
  halves.forEach(([plan, walk], half) => {
    const planter = planterOf(half, setup)
    moves[planter][slotOf(half, planter, setup)] = encodePlan(plan)
    walk.forEach((side, step) => {
      moves[other(planter)][slotOf(half, other(planter), setup) + step] = encodeStep(side)
    })
  })
  return moves
}

const PLAN: ShroomPlan = ['up', 'up', 'up', null, null]
const THREE_BOOMS: Side[] = ['up', 'up', 'up', 'up', 'up']
const ONE_BOOM: Side[] = ['up', 'down', 'down', 'down', 'down']
const TWO_BOOMS: Side[] = ['up', 'up', 'down', 'down', 'down']
const NO_BOOM: Side[] = ['down', 'down', 'down', 'down', 'down']

describe('SHROOM_RULES: moves', () => {
  const setup = soloSetup(3)

  it('keeps each player’s moves in a row: one for a plan, one per step for a walk', () => {
    expect(slotOf(0, 0, setup)).toBe(0)
    expect(slotOf(1, 0, setup)).toBe(1)
    expect(slotOf(1, 1, setup)).toBe(PATH_STEPS)
    expect(slotOf(2, 0, setup)).toBe(1 + PATH_STEPS)
  })

  it('reads a walk step by step, so it can be watched live', () => {
    const moves = playHalves(setup, [[PLAN, ['down', 'up']]])
    expect(halfMoves(moves, setup, 0)).toMatchObject({ planter: 0, walker: 1, plan: PLAN, steps: ['down', 'up'] })
    expect(halfResults(moves, setup)).toEqual([])
  })

  it('owes the plan first, then each step of the walk', () => {
    expect(SHROOM_RULES.owed([[], []], setup)).toEqual([{ player: 0, step: 0 }])
    const planted = playHalves(setup, [[PLAN, ['down']]])
    expect(SHROOM_RULES.owed(planted, setup)).toEqual([{ player: 1, step: 1 }])
  })

  it('fills in a poor step for a walker who never answered: onto the shroom', () => {
    const planted = playHalves(setup, [[PLAN, ['down']]])
    expect(decodeStep(SHROOM_RULES.fallback({ player: 1, step: 1 }, planted, setup))).toBe('up')
    expect(isPlanReady(decodePlan(SHROOM_RULES.fallback({ player: 0, step: 0 }, [[], []], setup)))).toBe(true)
  })
})

describe('SHROOM_RULES: solo', () => {
  const setup = soloSetup(3)

  it('you plant first, then the bot plants for you; booms and dodges are points', () => {
    expect(planterOf(0, setup)).toBe(0)
    expect(planterOf(1, setup)).toBe(1)
    // Half 0: the bot walks into all 3 of yours (3 for you). Half 1: you dodge all 3 of the bot's (3 more).
    const moves = playHalves(setup, [
      [PLAN, THREE_BOOMS],
      [PLAN, NO_BOOM],
    ])
    expect(SHROOM_RULES.settle(moves, setup)).toEqual({ winner: 0, scores: [6, 0] })
    expect(SHROOM_RULES.best?.of(moves, setup)).toBe(6)
  })

  it('plays a tied game again, and calls it a draw after 3', () => {
    const tied: [ShroomPlan, Side[]][] = [
      [PLAN, ONE_BOOM],
      [PLAN, ONE_BOOM],
    ]
    expect(SHROOM_RULES.settle(playHalves(setup, tied), setup)).toBeNull()
    const decided = playHalves(setup, [...tied, [PLAN, TWO_BOOMS], [PLAN, NO_BOOM]])
    expect(SHROOM_RULES.settle(decided, setup)).toEqual({ winner: 0, scores: [5, 1] })
    expect(SHROOM_RULES.settle(playHalves(setup, [...tied, ...tied, ...tied]), setup)).toEqual({ winner: null, scores: [3, 3] })
  })

  it('the bot walks only after you planted, and walks the whole path', () => {
    expect(SHROOM_RULES.botMove(0, [[], []], setup)).toBeUndefined()
    const bot = botMoves(SHROOM_RULES, [encodePlan(PLAN)], setup)
    // Its walk of your path, then its own plan for you.
    expect(bot).toHaveLength(PATH_STEPS + 1)
    expect(isPlanReady(decodePlan(bot[PATH_STEPS] ?? 0))).toBe(true)
  })
})

describe('SHROOM_RULES: Multiplayer', () => {
  const live = (bothRoles: boolean): GameSetup => ({ seed: 5, variant: 'live', bothRoles, late: false })

  it('one role each: 2 booms win it for the planter, fewer for the walker', () => {
    const setup = live(false)
    const planter: Player = planterOf(0, setup)
    const walker = other(planter)
    const twoBooms = SHROOM_RULES.settle(playHalves(setup, [[PLAN, TWO_BOOMS]]), setup)
    expect(twoBooms?.winner).toBe(planter)
    expect(twoBooms?.scores[planter]).toBe(2)
    expect(twoBooms?.scores[walker]).toBe(1)
    expect(SHROOM_RULES.settle(playHalves(setup, [[PLAN, ONE_BOOM]]), setup)?.winner).toBe(walker)
    expect(SHROOM_RULES.owed([[], []], setup)).toEqual([{ player: planter, step: 0 }])
  })

  it('both roles: most points over both walks wins, a tie goes to the coin', () => {
    const setup = live(true)
    const first = planterOf(0, setup)
    const won = SHROOM_RULES.settle(playHalves(setup, [[PLAN, TWO_BOOMS], [PLAN, ONE_BOOM]]), setup)
    // First planter: 2 booms + 2 dodges = 4. The other: 1 dodge + 1 boom = 2.
    expect(won?.winner).toBe(first)
    expect(won?.scores[first]).toBe(4)
    expect(SHROOM_RULES.settle(playHalves(setup, [[PLAN, ONE_BOOM], [PLAN, ONE_BOOM]]), setup)?.winner).toBeNull()
  })

  it('gives the game enough time for both halves', () => {
    expect(SHROOM_RULES.liveSeconds(live(true))).toBe(2 * SHROOM_RULES.liveSeconds(live(false)))
    expect(SHROOM_RULES.liveSeconds(live(false))).toBeGreaterThanOrEqual(35)
  })
})
