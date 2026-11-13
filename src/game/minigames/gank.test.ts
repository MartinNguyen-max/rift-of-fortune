import { describe, expect, it } from 'vitest'
import { botMoves, soloSetup, type GameSetup } from './versus'
import { favoriteBush, GANK_RULES, gankHalves, gankPoints, gankResults, hiderOf, NO_GUESS, SOLO_HALVES } from './gank'

const live = (bothRoles: boolean): GameSetup => ({ seed: 4, variant: 'live', bothRoles, late: false })

describe('halves', () => {
  it('lets you hide first solo, then switches every half', () => {
    const setup = soloSetup(1)
    expect([0, 1, 2, 3].map((half) => hiderOf(half, setup))).toEqual([0, 1, 0, 1])
    expect(gankHalves(setup)).toBe(SOLO_HALVES)
  })

  it('plays one half live, or one each with both roles', () => {
    expect(gankHalves(live(false))).toBe(1)
    expect(gankHalves(live(true))).toBe(2)
    expect(hiderOf(1, live(true))).not.toBe(hiderOf(0, live(true)))
  })
})

describe('gankResults and gankPoints', () => {
  const setup = soloSetup(1)

  it('scores a right guess for the guesser, anything else for the hider', () => {
    // Half 0: you hide top, the bot guesses top. Half 1: the bot hides bot, you guess mid.
    const results = gankResults([[0, 1], [0, 2]], setup)
    expect(results).toEqual([
      { hider: 0, bush: 0, guess: 0, found: true },
      { hider: 1, bush: 2, guess: 1, found: false },
    ])
    expect(gankPoints(results)).toEqual([0, 2])
  })

  it('counts no guess as a miss', () => {
    const [half] = gankResults([[2], [NO_GUESS]], setup)
    expect(half).toMatchObject({ guess: null, found: false })
  })
})

describe('GANK_RULES', () => {
  it('settles once every half is played; most points wins, a tie is a draw', () => {
    const setup = live(true)
    const hider = hiderOf(0, setup)
    const moves: [number[], number[]] = [[], []]
    // Both guesses are right: one point each.
    moves[hider] = [1, 2]
    moves[hider === 0 ? 1 : 0] = [1, 2]
    expect(GANK_RULES.settle([moves[0].slice(0, 1), moves[1].slice(0, 1)], setup)).toBeNull()
    expect(GANK_RULES.settle(moves, setup)).toEqual({ winner: null, scores: [1, 1] })
  })

  it('waits for the hider before the guesser owes a guess', () => {
    const setup = live(false)
    const hider = hiderOf(0, setup)
    expect(GANK_RULES.owed([[], []], setup)).toEqual([{ player: hider, step: 0 }])
    const hidden: [number[], number[]] = [[], []]
    hidden[hider] = [0]
    expect(GANK_RULES.owed(hidden, setup)).toEqual([{ player: hider === 0 ? 1 : 0, step: 0 }])
  })

  it('fills in a poor move: the middle bush, or no guess', () => {
    const setup = live(false)
    const hider = hiderOf(0, setup)
    expect(GANK_RULES.fallback({ player: hider, step: 0 }, [[], []], setup)).toBe(1)
    expect(GANK_RULES.fallback({ player: hider === 0 ? 1 : 0, step: 0 }, [[], []], setup)).toBe(NO_GUESS)
  })

  it('has a bot that guesses only after you hid', () => {
    const setup = soloSetup(2)
    expect(botMoves(GANK_RULES, [], setup)).toEqual([])
    expect(botMoves(GANK_RULES, [0], setup)).toHaveLength(2)
  })

  it('has a bot that reads a player who always hides in the same bush', () => {
    let found = 0
    for (let seed = 0; seed < 300; seed++) {
      const setup = soloSetup(seed)
      // You hide top in halves 0 and 2; the bot guesses in half 4.
      const player = [0, 1, 0, 1, 0]
      const bot = botMoves(GANK_RULES, player, setup)
      if (bot[4] === 0) found += 1
    }
    expect(found / 300).toBeGreaterThan(0.5)
  })

  it('finds a clear favorite bush', () => {
    expect(favoriteBush([0, 0, 2])).toBe(0)
    expect(favoriteBush([0, 2])).toBeNull()
    expect(favoriteBush([])).toBeNull()
  })
})
