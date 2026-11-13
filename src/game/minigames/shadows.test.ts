import { describe, expect, it } from 'vitest'
import {
  botPick,
  figuresAfter,
  formatShadowScore,
  NO_PICK,
  pickMove,
  readPick,
  realSpot,
  roundOfStep,
  SCORE_BASE,
  SHADOW_ROUNDS,
  SHADOW_RULES,
  shadowRound,
  shadowScore,
  shuffleMs,
  SPOTS,
  type ShadowRound,
  type Spot,
} from './shadows'
import { soloSetup, type BothMoves, type GameSetup } from './versus'

const live: GameSetup = { seed: 8, variant: 'live', bothRoles: false, late: false }
const solo = soloSetup(8)

/** The right pick for every round of a game, each taking `ms`. */
const rightPicks = (setup: GameSetup, ms: number) => [0, 1, 2].map((step) => pickMove(realSpot(roundOfStep(setup, step)), ms))
const wrongPick = (setup: GameSetup, step: number, ms: number) =>
  pickMove(((realSpot(roundOfStep(setup, step)) + 1) % 3) as Spot, ms)

describe('shadowRound', () => {
  it('is the same for everyone with the same seed', () => {
    expect(shadowRound(5, 1)).toEqual(shadowRound(5, 1))
    expect(shadowRound(5, 1)).not.toEqual(shadowRound(6, 1))
  })

  it('gets harder each round: more swaps, faster, and feints from round 2', () => {
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
  it('packs the spot and time into one move and back', () => {
    for (const spot of SPOTS) expect(readPick(pickMove(spot, 1234))).toEqual({ spot, ms: 1234 })
    expect(readPick(NO_PICK)).toEqual({ spot: null, ms: 5000 })
    expect(readPick(pickMove(1, 99_999)).ms).toBe(5000)
  })
})

describe('shadowScore', () => {
  it('counts right picks first', () => {
    const two = shadowScore([
      { right: true, ms: 4000 },
      { right: true, ms: 4000 },
      { right: false, ms: 100 },
    ])
    const one = shadowScore([{ right: true, ms: 100 }])
    expect(two).toBeGreaterThan(one)
    expect(Math.floor(two / SCORE_BASE)).toBe(2)
  })

  it('breaks a tie in right picks by the time they took', () => {
    const fast = shadowScore([{ right: true, ms: 800 }, { right: true, ms: 900 }])
    const slow = shadowScore([{ right: true, ms: 2000 }, { right: true, ms: 900 }])
    expect(fast).toBeGreaterThan(slow)
  })

  it('scores 0 without a right pick, however fast', () => {
    expect(shadowScore([{ right: false, ms: 10 }])).toBe(0)
  })

  it('shows right picks and their time', () => {
    expect(formatShadowScore(shadowScore([{ right: true, ms: 800 }, { right: true, ms: 1100 }]))).toBe('2/3 · 1.9 s')
    expect(formatShadowScore(0)).toBe('0/3')
  })
})

describe('SHADOW_RULES', () => {
  it('plays 3 rounds and settles once both picked every round', () => {
    const mine = rightPicks(live, 1000)
    expect(SHADOW_RULES.settle([mine, mine.slice(0, 2)], live)).toBeNull()
    expect(SHADOW_RULES.owed([mine, mine.slice(0, 2)], live)).toEqual([{ player: 1, step: 2 }])
    expect(SHADOW_RULES.settle([mine, [NO_PICK, NO_PICK, NO_PICK]], live)).toMatchObject({ winner: 0, scores: [expect.any(Number), 0] })
  })

  it('gives the win to more right picks, even when slower', () => {
    const slowAll = rightPicks(live, 4000)
    const fastTwo = [...rightPicks(live, 300).slice(0, 2), wrongPick(live, 2, 300)]
    expect(SHADOW_RULES.settle([slowAll, fastTwo], live)?.winner).toBe(0)
  })

  it('gives the win to the faster player with as many right picks', () => {
    expect(SHADOW_RULES.settle([rightPicks(live, 1500), rightPicks(live, 900)], live)?.winner).toBe(1)
  })

  it('is a tie with the same picks, or with no right pick at all', () => {
    expect(SHADOW_RULES.settle([rightPicks(live, 1000), rightPicks(live, 1000)], live)?.winner).toBeNull()
    const none: BothMoves = [
      [0, 1, 2].map((step) => wrongPick(live, step, 500)),
      [NO_PICK, NO_PICK, NO_PICK],
    ]
    expect(SHADOW_RULES.settle(none, live)).toEqual({ winner: null, scores: [0, 0] })
  })

  it('fills in a missed pick, which is never right', () => {
    const owed = { player: 0 as const, step: 0 }
    const fallback = SHADOW_RULES.fallback(owed, [[], []], live)
    expect(fallback).toBe(NO_PICK)
    expect(readPick(fallback).spot).toBeNull()
  })

  it('keeps the personal best as the score, higher is better', () => {
    const moves: BothMoves = [rightPicks(solo, 700), [NO_PICK, NO_PICK, NO_PICK]]
    expect(SHADOW_RULES.best?.lowerIsBetter).toBe(false)
    expect(SHADOW_RULES.best?.of(moves, solo)).toBe(SHADOW_RULES.settle(moves, solo)?.scores[0])
  })

  it('fits the Multiplayer time limit', () => {
    const seconds = SHADOW_RULES.liveSeconds(live)
    expect(seconds).toBeGreaterThan(30)
    expect(seconds).toBeLessThan(60)
  })

  it('has a bot that follows well at first and worse later', () => {
    const accuracy = (step: number) => {
      let right = 0
      for (let seed = 0; seed < 400; seed++) {
        const round = shadowRound(seed, step)
        if (readPick(botPick(round, step, seed * 7 + 1)).spot === realSpot(round)) right += 1
      }
      return right / 400
    }
    const [first, last] = [accuracy(0), accuracy(2)]
    expect(first).toBeGreaterThan(0.8)
    expect(last).toBeLessThan(0.65)
    expect(last).toBeGreaterThan(0.4)
  })

  it('lets the bot pick every round, then stops', () => {
    for (const step of [0, 1, 2]) expect(SHADOW_RULES.botMove(step, [[], []], solo)).toEqual(expect.any(Number))
    expect(SHADOW_RULES.botMove(3, [[], []], solo)).toBeUndefined()
  })
})
