import { describe, expect, it } from 'vitest'
import {
  DESTINY_RULES,
  destinyHalves,
  destinyPoints,
  destinyResults,
  favoriteLane,
  gankerOf,
  halfScorer,
  NO_GUESS,
  readGank,
  TIMEOUT_GANK,
  type DestinyHalf,
} from './destiny'
import { botMoves, firstPlayer, soloSetup, type BothMoves, type GameSetup, type Moves } from './versus'

const live = (bothRoles: boolean, seed = 7): GameSetup => ({ seed, variant: 'live', bothRoles, late: false })
const solo = soloSetup(11)

describe('Global Gank halves', () => {
  it('plays six halves solo, you ganking first, then alternating', () => {
    expect(destinyHalves(solo)).toBe(6)
    expect([0, 1, 2, 3].map((half) => gankerOf(half, solo))).toEqual([0, 1, 0, 1])
  })

  it('plays one half in Multiplayer, two with both roles, starting with the seed’s player', () => {
    expect(destinyHalves(live(false))).toBe(1)
    expect(destinyHalves(live(true))).toBe(2)
    const setup = live(true)
    expect(gankerOf(0, setup)).toBe(firstPlayer(setup))
    expect(gankerOf(1, setup)).not.toBe(gankerOf(0, setup))
  })

  it('reads anything malformed as a gank mid', () => {
    expect(readGank(2)).toBe(2)
    expect(readGank(42)).toBe(TIMEOUT_GANK)
  })
})

describe('Global Gank scoring', () => {
  it('gives the point to a right guess, otherwise to the ganker', () => {
    expect(halfScorer({ ganker: 0, lane: 1, guess: 1, countered: true })).toBe(1)
    expect(halfScorer({ ganker: 0, lane: 1, guess: 2, countered: false })).toBe(0)
    expect(halfScorer({ ganker: 1, lane: 0, guess: null, countered: false })).toBe(1)
  })

  it('reads halves from both players’ moves, a missing guess guessing nothing', () => {
    const setup = live(true, 3)
    const ganker = gankerOf(0, setup)
    const moves: [Moves, Moves] = [[], []]
    moves[ganker] = [2, NO_GUESS]
    moves[ganker === 0 ? 1 : 0] = [NO_GUESS, 0]
    const results = destinyResults(moves, setup)
    expect(results[0]).toEqual({ ganker, lane: 2, guess: null, countered: false })
    expect(results[1]).toEqual({ ganker: ganker === 0 ? 1 : 0, lane: 0, guess: null, countered: false })
    expect(destinyPoints(results)).toEqual([1, 1])
  })

  it('settles once every half is played: most points wins, equal is a tie', () => {
    const setup = live(false, 5)
    const ganker = gankerOf(0, setup)
    const guesser = ganker === 0 ? 1 : 0
    const play = (lane: number, guess: number): BothMoves => {
      const moves: [Moves, Moves] = [[], []]
      moves[ganker] = [lane]
      moves[guesser] = [guess]
      return moves
    }
    const onlyGank: [Moves, Moves] = [[], []]
    onlyGank[ganker] = [1]
    expect(DESTINY_RULES.settle(onlyGank, setup)).toBeNull()
    expect(DESTINY_RULES.settle(play(1, 0), setup)?.winner).toBe(ganker)
    expect(DESTINY_RULES.settle(play(1, 1), setup)?.winner).toBe(guesser)
    const both = live(true, 5)
    const tie: [Moves, Moves] = [[], []]
    const first = gankerOf(0, both)
    tie[first] = [0, 2]
    tie[first === 0 ? 1 : 0] = [1, 1]
    expect(DESTINY_RULES.settle(tie, both)?.winner).toBeNull()
  })

  it('owes the gank first, then the guess', () => {
    const setup = live(false, 9)
    const ganker = gankerOf(0, setup)
    expect(DESTINY_RULES.owed([[], []], setup)).toEqual([{ player: ganker, step: 0 }])
    const moves: [Moves, Moves] = [[], []]
    moves[ganker] = [0]
    expect(DESTINY_RULES.owed(moves, setup)).toEqual([{ player: ganker === 0 ? 1 : 0, step: 0 }])
  })

  it('fills in a gank mid, or no guess, for a player out of time', () => {
    const setup = live(false, 9)
    const ganker = gankerOf(0, setup)
    expect(DESTINY_RULES.fallback({ player: ganker, step: 0 }, [[], []], setup)).toBe(TIMEOUT_GANK)
    expect(DESTINY_RULES.fallback({ player: ganker === 0 ? 1 : 0, step: 0 }, [[], []], setup)).toBe(NO_GUESS)
  })
})

describe('Global Gank bot', () => {
  it('knows the lane you gank most', () => {
    const ganks = (...lanes: (0 | 1 | 2)[]): DestinyHalf[] => lanes.map((lane) => ({ ganker: 0, lane, guess: null, countered: false }))
    expect(favoriteLane([])).toBeNull()
    expect(favoriteLane(ganks(0, 2, 2))).toBe(2)
    expect(favoriteLane(ganks(0, 1))).toBe(1)
  })

  it('plays every half against you, guessing only after your gank is in', () => {
    const mine: Moves = [0, 1, 2, 0, 1, 2]
    const bot = botMoves(DESTINY_RULES, mine, solo)
    expect(bot).toHaveLength(6)
    expect(DESTINY_RULES.settle([mine, bot], solo)).not.toBeNull()
    expect(DESTINY_RULES.botMove(0, [[], []], solo)).toBeUndefined()
  })

  it('ganks every lane about as often', () => {
    const counts = [0, 0, 0]
    for (let seed = 1; seed <= 600; seed++) {
      const lane = DESTINY_RULES.botMove(1, [[], []], soloSetup(seed))
      if (lane !== undefined) counts[lane] = (counts[lane] ?? 0) + 1
    }
    for (const count of counts) expect(count).toBeGreaterThan(150)
  })
})
