import { describe, expect, it } from 'vitest'
import {
  BOT_SHADOWS,
  botPick,
  figuresAfter,
  formatFound,
  formatShadowScore,
  foundScore,
  NO_PICK,
  pickMove,
  readPick,
  realSpot,
  roundOfStep,
  roundWinner,
  roundWinners,
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
  it('packs the spot and time into one move and back', () => {
    for (const spot of SPOTS) expect(readPick(pickMove(spot, 1234))).toEqual({ spot, ms: 1234 })
    expect(readPick(NO_PICK)).toEqual({ spot: null, ms: 4000 })
    expect(readPick(pickMove(1, 99_999)).ms).toBe(4000)
  })
})

describe('rounds and scores', () => {
  const right = (ms: number) => ({ spot: 0 as const, ms, right: true })
  const wrong = (ms: number) => ({ spot: 1 as const, ms, right: false })

  it('gives a round to the fastest right pick; a right pick beats a wrong one, however fast', () => {
    expect(roundWinner(right(900), right(700))).toBe(1)
    expect(roundWinner(right(3000), wrong(100))).toBe(0)
    expect(roundWinner(wrong(100), wrong(200))).toBeNull()
    expect(roundWinner(right(800), right(800))).toBeNull()
  })

  it('counts rounds won first, then the time the right picks took', () => {
    const twoRounds = shadowScore(2, [right(3000), right(3000), wrong(100)])
    const oneRound = shadowScore(1, [right(100), right(100), right(100)])
    expect(twoRounds).toBeGreaterThan(oneRound)
    expect(Math.floor(twoRounds / SCORE_BASE)).toBe(2)
    expect(shadowScore(1, [right(800)])).toBeGreaterThan(shadowScore(1, [right(900)]))
    expect(shadowScore(0, [wrong(10)])).toBe(0)
  })

  it('shows rounds won and time, and the personal best as Zeds found', () => {
    expect(formatShadowScore(shadowScore(2, [right(800), right(1100)]))).toBe('2 rounds · 1.9 s')
    expect(formatShadowScore(shadowScore(0, [right(500)]))).toBe('0 rounds · 0.5 s')
    expect(formatShadowScore(0)).toBe('0 rounds')
    expect(formatFound(foundScore([right(800), wrong(300), right(1100)]))).toBe('2/3 found · 1.9 s')
    expect(formatFound(0)).toBe('0/3 found')
  })
})

describe('SHADOW_RULES', () => {
  it('plays 3 rounds and settles once both picked every round', () => {
    const mine = rightPicks(live, 1000)
    expect(SHADOW_RULES.settle([mine, mine.slice(0, 2)], live)).toBeNull()
    expect(SHADOW_RULES.owed([mine, mine.slice(0, 2)], live)).toEqual([{ player: 1, step: 2 }])
    expect(SHADOW_RULES.settle([mine, [NO_PICK, NO_PICK, NO_PICK]], live)).toMatchObject({ winner: 0, scores: [expect.any(Number), 0] })
  })

  it('gives the win to most rounds won: speed beats finding Zed slowly', () => {
    const slowAll = rightPicks(live, 3500)
    const fastTwo = [...rightPicks(live, 300).slice(0, 2), wrongPick(live, 2, 300)]
    expect(roundWinners([slowAll, fastTwo], live)).toEqual([1, 1, 0])
    expect(SHADOW_RULES.settle([slowAll, fastTwo], live)?.winner).toBe(1)
  })

  it('breaks a tie in rounds by the faster right picks', () => {
    const a = [rightPicks(live, 800)[0] ?? 0, wrongPick(live, 1, 300), wrongPick(live, 2, 300)]
    const b = [wrongPick(live, 0, 300), rightPicks(live, 1200)[1] ?? 0, wrongPick(live, 2, 300)]
    // One round each, the last one nobody's: a found Zed faster.
    expect(roundWinners([a, b], live)).toEqual([0, 1, null])
    expect(SHADOW_RULES.settle([a, b], live)?.winner).toBe(0)
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

  it('keeps the Zeds you found (then speed) as the personal best, higher is better', () => {
    const moves: BothMoves = [rightPicks(solo, 700), [NO_PICK, NO_PICK, NO_PICK]]
    expect(SHADOW_RULES.best?.lowerIsBetter).toBe(false)
    const best = SHADOW_RULES.best?.of(moves, solo) ?? 0
    expect(SHADOW_RULES.best?.format(best)).toBe('3/3 found · 2.1 s')
    expect(SHADOW_RULES.best?.of([moves[0].slice(0, 2), []], solo)).toBeNull()
  })

  it('fits the Multiplayer time limit', () => {
    const seconds = SHADOW_RULES.liveSeconds(live)
    expect(seconds).toBeGreaterThan(30)
    expect(seconds).toBeLessThan(60)
  })

  it('has a bot that finds Zed about 1.5 times a game: often at first, rarely at the end', () => {
    const accuracy = (step: number) => {
      let right = 0
      for (let seed = 0; seed < 600; seed++) {
        const round = shadowRound(seed, step)
        if (readPick(botPick(round, step, seed * 7 + 1)).spot === realSpot(round)) right += 1
      }
      return right / 600
    }
    const rounds = [accuracy(0), accuracy(1), accuracy(2)]
    const perGame = rounds.reduce((total, rate) => total + rate, 0)
    expect(perGame).toBeGreaterThan(1.3)
    expect(perGame).toBeLessThan(1.7)
    expect(rounds[0]).toBeGreaterThan(rounds[2] ?? 1)
  })

  it('has a bot that picks like a quick human, a little slower each round', () => {
    for (let seed = 0; seed < 100; seed++) {
      for (const step of [0, 1, 2]) {
        const { ms } = readPick(botPick(shadowRound(seed, step), step, seed))
        expect(ms).toBeGreaterThanOrEqual(BOT_SHADOWS.pickMs.min)
        expect(ms).toBeLessThanOrEqual(BOT_SHADOWS.pickMs.max + step * BOT_SHADOWS.slowerPerRound)
      }
    }
  })

  it('lets the bot pick every round, then stops', () => {
    for (const step of [0, 1, 2]) expect(SHADOW_RULES.botMove(step, [[], []], solo)).toEqual(expect.any(Number))
    expect(SHADOW_RULES.botMove(3, [[], []], solo)).toBeUndefined()
  })
})
