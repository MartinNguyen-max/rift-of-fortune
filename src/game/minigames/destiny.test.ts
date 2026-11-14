import { describe, expect, it } from 'vitest'
import {
  BOT_DESTINY,
  DESTINY_POINTS,
  DESTINY_RULES,
  destinyHalves,
  destinyPoints,
  destinyResults,
  gateMove,
  gaterOf,
  guardCardChance,
  halfScore,
  NO_GUARD,
  readGate,
  TIMEOUT_GATE,
  type DestinyHalf,
} from './destiny'
import { botMoves, firstPlayer, soloSetup, type BothMoves, type GameSetup, type Moves } from './versus'

const live = (bothRoles: boolean, seed = 7): GameSetup => ({ seed, variant: 'live', bothRoles, late: false })
const solo = soloSetup(11)

describe('Destiny moves', () => {
  it('packs the card and the Gate into one move and back', () => {
    for (const card of [0, 1, 2] as const) {
      for (const lane of [0, 1, 2] as const) expect(readGate(gateMove({ card, lane }))).toEqual({ card, lane })
    }
  })

  it('reads anything malformed as an honest Gate to mid', () => {
    expect(readGate(42)).toEqual({ card: 1, lane: 1 })
    expect(readGate(TIMEOUT_GATE)).toEqual({ card: 1, lane: 1 })
  })
})

describe('Destiny halves', () => {
  it('plays six halves solo, you first as Twisted Fate, then alternating', () => {
    expect(destinyHalves(solo)).toBe(6)
    expect([0, 1, 2, 3].map((half) => gaterOf(half, solo))).toEqual([0, 1, 0, 1])
  })

  it('plays one half in Multiplayer, two with both roles, starting with the seed’s player', () => {
    expect(destinyHalves(live(false))).toBe(1)
    expect(destinyHalves(live(true))).toBe(2)
    const setup = live(true)
    expect(gaterOf(0, setup)).toBe(firstPlayer(setup))
    expect(gaterOf(1, setup)).not.toBe(gaterOf(0, setup))
  })
})

describe('Destiny scoring', () => {
  const half = (overrides: Partial<DestinyHalf>): DestinyHalf => ({ gater: 0, card: 0, lane: 0, guard: 2, guarded: false, honest: true, ...overrides })

  it('gives 2 to Twisted Fate landing free on his card’s lane, 1 after a bluff', () => {
    expect(halfScore(half({ honest: true }))).toEqual({ scorer: 0, points: DESTINY_POINTS.honest })
    expect(halfScore(half({ card: 0, lane: 1, honest: false }))).toEqual({ scorer: 0, points: DESTINY_POINTS.bluff })
  })

  it('gives 1 to the guard who is in his lane, honest or not', () => {
    expect(halfScore(half({ guard: 0, guarded: true }))).toEqual({ scorer: 1, points: DESTINY_POINTS.guarded })
    expect(halfScore(half({ gater: 1, card: 2, lane: 0, guard: 0, guarded: true, honest: false }))).toEqual({ scorer: 0, points: 1 })
  })

  it('reads halves from both players’ moves, a missing guard guarding nothing', () => {
    const setup = live(true, 3)
    const gater = gaterOf(0, setup)
    const moves: [Moves, Moves] = [[], []]
    moves[gater] = [gateMove({ card: 2, lane: 2 }), NO_GUARD]
    moves[gater === 0 ? 1 : 0] = [NO_GUARD, gateMove({ card: 0, lane: 1 })]
    const results = destinyResults(moves, setup)
    expect(results[0]).toMatchObject({ gater, card: 2, lane: 2, guard: null, guarded: false, honest: true })
    expect(results[1]).toMatchObject({ card: 0, lane: 1, guard: null, honest: false })
    const points = destinyPoints(results)
    expect(points[gater]).toBe(2)
    expect(points[gater === 0 ? 1 : 0]).toBe(1)
  })

  it('settles once every half is played: most points wins, equal is a tie', () => {
    const setup = live(false, 5)
    const gater = gaterOf(0, setup)
    const guard = gater === 0 ? 1 : 0
    const play = (gate: number, guarded: number): BothMoves => {
      const moves: [Moves, Moves] = [[], []]
      moves[gater] = [gate]
      moves[guard] = [guarded]
      return moves
    }
    const onlyGate: [Moves, Moves] = [[], []]
    onlyGate[gater] = [gateMove({ card: 1, lane: 1 })]
    expect(DESTINY_RULES.settle(onlyGate, setup)).toBeNull()
    const free = DESTINY_RULES.settle(play(gateMove({ card: 1, lane: 1 }), 0), setup)
    expect(free?.winner).toBe(gater)
    expect(free?.scores[gater]).toBe(2)
    const caught = DESTINY_RULES.settle(play(gateMove({ card: 1, lane: 0 }), 0), setup)
    expect(caught?.winner).toBe(guard)
    const both = live(true, 5)
    const tie: [Moves, Moves] = [[], []]
    const first = gaterOf(0, both)
    tie[first] = [gateMove({ card: 0, lane: 1 }), 1]
    tie[first === 0 ? 1 : 0] = [2, gateMove({ card: 2, lane: 0 })]
    expect(DESTINY_RULES.settle(tie, both)?.winner).toBeNull()
  })

  it('owes Twisted Fate’s Gate first, then the guard', () => {
    const setup = live(false, 9)
    const gater = gaterOf(0, setup)
    expect(DESTINY_RULES.owed([[], []], setup)).toEqual([{ player: gater, step: 0 }])
    const moves: [Moves, Moves] = [[], []]
    moves[gater] = [gateMove({ card: 0, lane: 0 })]
    expect(DESTINY_RULES.owed(moves, setup)).toEqual([{ player: gater === 0 ? 1 : 0, step: 0 }])
  })

  it('fills in an honest Gate to mid, or no guard, for a player out of time', () => {
    const setup = live(false, 9)
    const gater = gaterOf(0, setup)
    expect(DESTINY_RULES.fallback({ player: gater, step: 0 }, [[], []], setup)).toBe(TIMEOUT_GATE)
    expect(DESTINY_RULES.fallback({ player: gater === 0 ? 1 : 0, step: 0 }, [[], []], setup)).toBe(NO_GUARD)
  })
})

describe('Destiny bot', () => {
  it('guards the card more the more often you were honest', () => {
    const gates = (honest: number, total: number): DestinyHalf[] =>
      Array.from({ length: total }, (_, index) => ({ gater: 0, card: 0, lane: index < honest ? 0 : 1, guard: 2, guarded: false, honest: index < honest }))
    expect(guardCardChance([])).toBe(BOT_DESTINY.guardCard.unread)
    expect(guardCardChance(gates(0, 2))).toBe(BOT_DESTINY.guardCard.never)
    expect(guardCardChance(gates(2, 2))).toBe(BOT_DESTINY.guardCard.always)
  })

  it('plays every half against you, guarding only after your card shows', () => {
    const mine: Moves = [gateMove({ card: 0, lane: 0 }), 1, gateMove({ card: 2, lane: 1 }), 0, gateMove({ card: 1, lane: 1 }), 2]
    const bot = botMoves(DESTINY_RULES, mine, solo)
    expect(bot).toHaveLength(6)
    expect(DESTINY_RULES.settle([mine, bot], solo)).not.toBeNull()
    expect(DESTINY_RULES.botMove(0, [[], []], solo)).toBeUndefined()
  })

  it('bluffs often enough that a guard who always trusts the card loses', () => {
    let trusting = 0
    let total = 0
    for (let seed = 1; seed <= 600; seed++) {
      const setup = soloSetup(seed)
      // You guard the card's lane every time the bot Gates (odd halves).
      for (const half of [1, 3, 5]) {
        const gate = DESTINY_RULES.botMove(half, [[], []], setup)
        if (gate === undefined) continue
        const { card, lane } = readGate(gate)
        total += 1
        if (card === lane) trusting += 1
      }
    }
    expect(trusting / total).toBeGreaterThan(0.25)
    expect(trusting / total).toBeLessThan(0.45)
  })
})
