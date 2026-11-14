import { describe, expect, it } from 'vitest'
import {
  botPick,
  figuresAfter,
  formatFound,
  foundCount,
  NO_PICK,
  readPick,
  realSpot,
  roundOfStep,
  roundWinner,
  roundWinners,
  SHADOW_ROUNDS,
  SHADOW_RULES,
  shadowRound,
  shuffleMs,
  SPOTS,
  type ShadowRound,
  type Spot,
} from './shadows'
import { soloSetup, type BothMoves, type GameSetup } from './versus'

const live: GameSetup = { seed: 8, variant: 'live', bothRoles: false, late: false }
const solo = soloSetup(8)

/** The right pick for every round of a game. */
const rightPicks = (setup: GameSetup): number[] => [0, 1, 2].map((step) => realSpot(roundOfStep(setup, step)))
const wrongPick = (setup: GameSetup, step: number): Spot => ((realSpot(roundOfStep(setup, step)) + 1) % 3) as Spot

describe('shadowRound', () => {
  it('is the same for everyone with the same seed', () => {
    expect(shadowRound(5, 1)).toEqual(shadowRound(5, 1))
    expect(shadowRound(5, 1)).not.toEqual(shadowRound(6, 1))
  })

  it('gets harder each round: more swaps and feints, and faster', () => {
    for (let seed = 0; seed < 50; seed++) {
      const rounds = [0, 1, 2].map((round) => shadowRound(seed, round))
      rounds.forEach((round, index) => {
        const config = SHADOW_ROUNDS[index]
        expect(round.swaps.filter(({ feint }) => !feint)).toHaveLength(config?.swaps ?? 0)
        expect(round.swaps.filter(({ feint }) => feint)).toHaveLength(config?.feints ?? 0)
      })
      expect(rounds[1]?.swapMs).toBeLessThan(rounds[0]?.swapMs ?? 0)
      expect(rounds[2]?.swapMs).toBeLessThan(rounds[1]?.swapMs ?? 0)
    }
  })

  it('never swaps the same pair twice in a row and never starts with a feint', () => {
    for (let seed = 0; seed < 100; seed++) {
      const round = shadowRound(seed, 2)
      expect(round.swaps[0]?.feint).toBe(false)
      const real = round.swaps.filter(({ feint }) => !feint)
      real.slice(1).forEach((swap, index) => {
        const before = real[index]
        const pair = (s: typeof swap) => [s.from, s.to].sort().join()
        if (before) expect(pair(swap)).not.toBe(pair(before))
      })
    }
  })

  it('keeps the shuffle short enough to follow', () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const step of [0, 1, 2]) expect(shuffleMs(shadowRound(seed, step))).toBeLessThan(4500)
    }
  })
})

describe('figuresAfter and realSpot', () => {
  const round: ShadowRound = {
    start: 0,
    swapMs: 500,
    swaps: [
      { from: 0, to: 1, feint: false },
      { from: 1, to: 2, feint: true },
      { from: 2, to: 1, feint: false },
    ],
  }

  it('follows the swaps and ignores feints', () => {
    expect(figuresAfter(round, 0)).toEqual([0, 1, 2])
    expect(figuresAfter(round, 1)).toEqual([1, 0, 2])
    expect(figuresAfter(round, 2)).toEqual([1, 0, 2])
    expect(figuresAfter(round)).toEqual([1, 2, 0])
    expect(realSpot(round)).toBe(2)
  })

  it('always ends with one figure per spot', () => {
    for (let seed = 0; seed < 50; seed++) {
      const figures = figuresAfter(shadowRound(seed, 2))
      expect([...figures].sort()).toEqual([0, 1, 2])
    }
  })
})

describe('picks', () => {
  it('is just the spot; anything else is no pick', () => {
    for (const spot of SPOTS) expect(readPick(spot)).toBe(spot)
    expect(readPick(NO_PICK)).toBeNull()
    expect(readPick(42)).toBeNull()
  })
})

describe('rounds and scores', () => {
  const right = { spot: 0 as const, right: true }
  const wrong = { spot: 1 as const, right: false }

  it('gives a round to the only right pick; both right or both wrong is even', () => {
    expect(roundWinner(right, wrong)).toBe(0)
    expect(roundWinner(wrong, right)).toBe(1)
    expect(roundWinner(right, right)).toBeNull()
    expect(roundWinner(wrong, wrong)).toBeNull()
  })

  it('counts the Zeds found', () => {
    expect(foundCount([right, wrong, right])).toBe(2)
    expect(formatFound(2)).toBe('2/3\u00a0found')
  })
})

describe('SHADOW_RULES', () => {
  it('plays 3 rounds and settles once both picked every round', () => {
    const mine = rightPicks(live)
    expect(SHADOW_RULES.settle([mine, mine.slice(0, 2)], live)).toBeNull()
    expect(SHADOW_RULES.owed([mine, mine.slice(0, 2)], live)).toEqual([{ player: 1, step: 2 }])
    expect(SHADOW_RULES.settle([mine, [NO_PICK, NO_PICK, NO_PICK]], live)).toEqual({ winner: 0, scores: [3, 0] })
  })

  it('gives the win to most Zeds found, with no speed at all', () => {
    const two = [...rightPicks(live).slice(0, 2), wrongPick(live, 2)]
    const one = [wrongPick(live, 0), wrongPick(live, 1), rightPicks(live)[2] ?? 0]
    expect(roundWinners([two, one], live)).toEqual([0, 0, 1])
    expect(SHADOW_RULES.settle([two, one], live)).toEqual({ winner: 0, scores: [2, 1] })
  })

  it('is a tie with as many found, or none at all', () => {
    const a = [rightPicks(live)[0] ?? 0, wrongPick(live, 1), wrongPick(live, 2)]
    const b = [wrongPick(live, 0), rightPicks(live)[1] ?? 0, wrongPick(live, 2)]
    expect(SHADOW_RULES.settle([a, b], live)?.winner).toBeNull()
    const none: BothMoves = [[0, 1, 2].map((step) => wrongPick(live, step)), [NO_PICK, NO_PICK, NO_PICK]]
    expect(SHADOW_RULES.settle(none, live)).toEqual({ winner: null, scores: [0, 0] })
  })

  it('fills in a missed pick, which is never right', () => {
    const fallback = SHADOW_RULES.fallback({ player: 0, step: 0 }, [[], []], live)
    expect(fallback).toBe(NO_PICK)
    expect(readPick(fallback)).toBeNull()
  })

  it('keeps the Zeds you found as the personal best, higher is better', () => {
    const moves: BothMoves = [rightPicks(solo), [NO_PICK, NO_PICK, NO_PICK]]
    expect(SHADOW_RULES.best?.lowerIsBetter).toBe(false)
    const best = SHADOW_RULES.best?.of(moves, solo) ?? 0
    expect(SHADOW_RULES.best?.format(best)).toBe('3/3\u00a0found')
    expect(SHADOW_RULES.best?.of([moves[0].slice(0, 2), []], solo)).toBeNull()
  })

  it('fits the Multiplayer time limit', () => {
    const seconds = SHADOW_RULES.liveSeconds(live)
    expect(seconds).toBeGreaterThan(30)
    expect(seconds).toBeLessThan(90)
  })

  it('has a bot that finds Zed once or twice a game: often at first, about a lucky guess at the end', () => {
    const accuracy = (step: number) => {
      let right = 0
      for (let seed = 0; seed < 600; seed++) {
        const round = shadowRound(seed, step)
        if (botPick(round, step, seed * 7 + 1) === realSpot(round)) right += 1
      }
      return right / 600
    }
    const rounds = [accuracy(0), accuracy(1), accuracy(2)]
    const perGame = rounds.reduce((total, rate) => total + rate, 0)
    expect(perGame).toBeGreaterThan(1.1)
    expect(perGame).toBeLessThan(1.5)
    expect(rounds[0]).toBeGreaterThan(rounds[2] ?? 1)
  })

  it('lets the bot pick every round, then stops', () => {
    for (const step of [0, 1, 2]) expect(SHADOW_RULES.botMove(step, [[], []], solo)).toEqual(expect.any(Number))
    expect(SHADOW_RULES.botMove(3, [[], []], solo)).toBeUndefined()
  })
})
