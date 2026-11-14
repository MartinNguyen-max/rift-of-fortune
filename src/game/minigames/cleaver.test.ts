import { describe, expect, it } from 'vitest'
import { seededRandom } from '../random'
import {
  botDodge,
  botThrow,
  CLEAVER_RULES,
  cleaverTurns,
  dodgeTo,
  favoriteSpot,
  hitsLanded,
  MAX_TURNS,
  reachable,
  spotsAfter,
  START_SPOT,
  throwerOf,
} from './cleaver'
import { botMoves, soloSetup, type GameSetup } from './versus'

const solo = soloSetup(3)
const live: GameSetup = { seed: 3, variant: 'live', bothRoles: false, late: false }

describe('spots', () => {
  it('lets a Mundo move at most one spot', () => {
    expect(reachable(0)).toEqual([0, 1])
    expect(reachable(1)).toEqual([0, 1, 2])
    expect(reachable(2)).toEqual([1, 2])
  })

  it('counts a dodge too far away as staying put', () => {
    expect(dodgeTo(0, 2)).toBe(0)
    expect(dodgeTo(0, 1)).toBe(1)
    expect(dodgeTo(1, 7)).toBe(1)
  })

  it('finds a clear favorite spot', () => {
    expect(favoriteSpot([2, 2, 0])).toBe(2)
    expect(favoriteSpot([0, 2])).toBeNull()
  })
})

describe('turns', () => {
  it('lets you throw first solo, then switches every turn', () => {
    expect([0, 1, 2, 3].map((turn) => throwerOf(turn, solo))).toEqual([0, 1, 0, 1])
  })

  it('hits when the cleaver lands on the dodger’s new spot, and keeps where each Mundo stands', () => {
    // Turn 0: you throw top, the bot dodges mid → top: hit. Turn 1: the bot throws bot, you dodge mid → top.
    const turns = cleaverTurns([[0, 0], [0, 2]], solo)
    expect(turns).toEqual([
      { thrower: 0, target: 0, from: START_SPOT, to: 0, hit: true },
      { thrower: 1, target: 2, from: START_SPOT, to: 0, hit: false },
    ])
    expect(spotsAfter(turns)).toEqual([0, 0])
    expect(hitsLanded(turns)).toEqual([1, 0])
  })

  it('keeps a dodger from jumping from top to bot', () => {
    // You end turn 1 on top; in turn 3 you try bot, so you stay top and the bot's top throw hits.
    const turns = cleaverTurns([[1, 0, 1, 2], [2, 0, 1, 0]], solo)
    expect(turns[3]).toMatchObject({ from: 0, to: 0, hit: true })
  })
})

describe('CLEAVER_RULES', () => {
  it('ends at 3 hits', () => {
    // You throw where the bot goes three times; the bot always misses.
    const settled = CLEAVER_RULES.settle([[1, 1, 1, 0, 1], [1, 0, 1, 2, 1]], solo)
    expect(settled).toEqual({ winner: 0, scores: [3, 0] })
  })

  it('ends at the turn limit: most hits wins, a tie is a draw', () => {
    const thrower = throwerOf(0, live)
    // The first thrower always throws mid, where the other Mundo stays on its dodges: 3 hits and a win.
    const moves: [number[], number[]] = [[], []]
    moves[thrower] = [1, 1, 1, 1, 1, 1]
    moves[thrower === 0 ? 1 : 0] = [1, 0, 1, 0, 1, 0]
    expect(CLEAVER_RULES.settle(moves, live)?.winner).toBe(thrower)
    // One always goes top and throws top, the other always goes bot and throws bot: nobody is ever hit.
    const tie = CLEAVER_RULES.settle([[0, 0, 0, 0, 0, 0], [2, 2, 2, 2, 2, 2]], live)
    expect(tie).toEqual({ winner: null, scores: [0, 0] })
    expect(MAX_TURNS.live).toBe(6)
  })

  it('owes both players the next turn until decided', () => {
    expect(CLEAVER_RULES.owed([[1], []], solo)).toEqual([{ player: 1, step: 0 }])
    expect(CLEAVER_RULES.owed([[1], [0]], solo)).toEqual([
      { player: 0, step: 1 },
      { player: 1, step: 1 },
    ])
  })

  it('fills in a poor move: the dodger stays, the thrower misses when it can', () => {
    // After turn 0 the bot (dodger) went to top. In turn 2 you throw again, out of time.
    const moves: [number[], number[]] = [[2, 1], [0, 2]]
    expect(CLEAVER_RULES.fallback({ player: 1, step: 2 }, moves, solo)).toBe(0)
    expect(CLEAVER_RULES.fallback({ player: 0, step: 2 }, moves, solo)).toBe(2)
  })

  it('has a bot that only plays reachable spots and waits for your earlier turns', () => {
    expect(botMoves(CLEAVER_RULES, [], solo)).toHaveLength(1)
    const bot = botMoves(CLEAVER_RULES, [1, 1, 1], solo)
    expect(bot).toHaveLength(4)
    const turns = cleaverTurns([[1, 1, 1], bot.slice(0, 3)], solo)
    for (const turn of turns) expect(reachable(turn.from)).toContain(turn.to)
  })
})

describe('bot habits', () => {
  it('throws where you like to dodge', () => {
    const random = seededRandom(3)
    const throws = Array.from({ length: 300 }, () => botThrow([2, 2, 2], 1, random))
    expect(throws.filter((spot) => spot === 2).length / throws.length).toBeGreaterThan(0.55)
  })

  it('never throws where you can’t be', () => {
    const random = seededRandom(5)
    for (let index = 0; index < 100; index++) expect(botThrow([2, 2], 0, random)).not.toBe(2)
  })

  it('dodges away from where you like to throw', () => {
    const random = seededRandom(4)
    const dodges = Array.from({ length: 300 }, () => botDodge([0, 0], 1, random))
    expect(dodges.filter((spot) => spot === 0).length / dodges.length).toBeLessThan(0.25)
  })
})
