import { describe, expect, it } from 'vitest'
import {
  BOT_DEVOUR,
  botDevour,
  DEVOUR,
  DEVOUR_RULES,
  devourPoints,
  devourResult,
  devourRockets,
  impactMs,
  NO_DEVOUR,
  rocketProgress,
  type Rocket,
} from './devour'
import { soloSetup, type BothMoves, type GameSetup } from './versus'

const SEED = 4242
const live: GameSetup = { seed: SEED, variant: 'live', bothRoles: false, late: false }
const rocket: Rocket = { ally: 'Ezreal', windUpMs: 1000, flightMs: 2000, boost: 2 }
/** A Devour `margin` ms before the impact. */
const before = (margin: number, target: Rocket = rocket) => impactMs(target) - margin

describe('rockets', () => {
  it('are the same for both players, each for a different carry, within the limits', () => {
    const rockets = devourRockets(SEED)
    expect(devourRockets(SEED)).toEqual(rockets)
    expect(rockets).toHaveLength(DEVOUR.rockets)
    expect(new Set(rockets.map(({ ally }) => ally)).size).toBe(DEVOUR.rockets)
    for (const { windUpMs, flightMs, boost } of rockets) {
      expect(windUpMs).toBeGreaterThanOrEqual(DEVOUR.windUpMs.min)
      expect(windUpMs).toBeLessThanOrEqual(DEVOUR.windUpMs.max)
      expect(flightMs).toBeGreaterThanOrEqual(DEVOUR.flightMs.min)
      expect(flightMs).toBeLessThanOrEqual(DEVOUR.flightMs.max)
      expect(boost).toBeGreaterThan(1)
    }
  })

  it('speeds up as it flies: slow at first, then most of the way at the end', () => {
    expect(rocketProgress(rocket, 500)).toBe(0)
    expect(rocketProgress(rocket, 2000)).toBeCloseTo(0.25)
    expect(rocketProgress(rocket, impactMs(rocket))).toBe(1)
    expect(rocketProgress(rocket, 9999)).toBe(1)
  })
})

describe('devourResult', () => {
  it('scores 100 for a Devour right before the impact', () => {
    expect(devourResult(rocket, before(0))).toMatchObject({ outcome: 'perfect', points: 100 })
    expect(devourResult(rocket, before(DEVOUR.perfectMs))).toMatchObject({ outcome: 'perfect', points: 100 })
  })

  it('scores less the earlier it was, down to the start of the safe window', () => {
    const near = devourResult(rocket, before(200)).points
    const far = devourResult(rocket, before(DEVOUR.safeMs)).points
    expect(near).toBeLessThan(100)
    expect(far).toBeLessThan(near)
    expect(far).toBe(DEVOUR.minPoints)
  })

  it('spits the carry out too early, and is too late after the impact or without a press', () => {
    expect(devourResult(rocket, before(DEVOUR.safeMs + 1))).toMatchObject({ outcome: 'early', points: 0 })
    expect(devourResult(rocket, before(-1))).toMatchObject({ outcome: 'late', points: 0 })
    expect(devourResult(rocket, NO_DEVOUR)).toEqual({ outcome: 'late', points: 0, margin: null })
  })
})

describe('the game', () => {
  const rockets = devourRockets(SEED)
  const at = (margin: number) => rockets.map((target) => before(margin, target))

  it('adds up the points of the three rockets and settles once both played them all', () => {
    const moves: BothMoves = [at(0), at(DEVOUR.safeMs)]
    expect(devourPoints(moves, SEED)).toEqual([
      [100, 100, 100],
      [DEVOUR.minPoints, DEVOUR.minPoints, DEVOUR.minPoints],
    ])
    expect(DEVOUR_RULES.settle(moves, live)).toEqual({ winner: 0, scores: [300, 3 * DEVOUR.minPoints] })
    expect(DEVOUR_RULES.settle([at(0).slice(0, 2), at(0)], live)).toBeNull()
  })

  it('calls equal points a tie', () => {
    expect(DEVOUR_RULES.settle([at(30), at(10)], live)?.winner).toBeNull()
  })

  it('owes each player their next rocket, and fills in a press that never came as too late', () => {
    expect(DEVOUR_RULES.owed([[], at(0).slice(0, 1)], live)).toEqual([
      { player: 0, step: 0 },
      { player: 1, step: 1 },
    ])
    expect(DEVOUR_RULES.fallback({ player: 0, step: 0 }, [[], []], live)).toBe(NO_DEVOUR)
  })

  it('keeps your total as the personal best, higher is better', () => {
    const setup = soloSetup(SEED)
    expect(DEVOUR_RULES.best?.of([at(0), at(0)], setup)).toBe(300)
    expect(DEVOUR_RULES.best?.lowerIsBetter).toBe(false)
    expect(DEVOUR_RULES.formatScore(245, setup)).toBe('245 pts')
  })

  it('fits three rockets in the Multiplayer time limit', () => {
    const longest = rockets.reduce((sum, target) => sum + impactMs(target), 0) / 1000
    expect(DEVOUR_RULES.liveSeconds(live)).toBeGreaterThan(longest + 3)
  })
})

describe('the bot', () => {
  it('saves most carries, but not every one, for about 60 points a rocket', () => {
    const points: number[] = []
    for (let seed = 1; seed <= 2000; seed++) {
      for (const [step, target] of devourRockets(seed).entries()) {
        points.push(devourResult(target, botDevour(seed, step) ?? NO_DEVOUR).points)
      }
    }
    const average = points.reduce((sum, value) => sum + value, 0) / points.length
    const missed = points.filter((value) => value === 0).length / points.length
    expect(average).toBeGreaterThan(45)
    expect(average).toBeLessThan(75)
    expect(missed).toBeGreaterThan(BOT_DEVOUR.panicChance)
    expect(missed).toBeLessThan(0.3)
  })

  it('has no move past the last rocket', () => {
    expect(botDevour(SEED, DEVOUR.rockets)).toBeUndefined()
  })
})
