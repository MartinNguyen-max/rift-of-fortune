import { describe, expect, it } from 'vitest'
import {
  DESTINY_GANKS,
  DESTINY_POINTS,
  DESTINY_RULES,
  destinyPoints,
  destinyResults,
  favoriteLane,
  gankerOf,
  halfPoints,
  halfScorer,
  NO_GUESS,
  readGank,
  TIMEOUT_GANK,
  type DestinyHalf,
} from './destiny'
import { seededRandom } from '../random'
import { botMoves, firstPlayer, soloSetup, type GameSetup, type Moves } from './versus'

const live = (seed = 7): GameSetup => ({ seed, variant: 'live', bothRoles: true, late: false })
const solo = soloSetup(11)

/** Moves for a whole game: the ganker's lanes and the guesser's guesses, by player. */
function play(setup: GameSetup, lanes: number[], guesses: number[]): [Moves, Moves] {
  const moves: [Moves, Moves] = [[], []]
  const ganker = gankerOf(setup)
  moves[ganker] = lanes
  moves[ganker === 0 ? 1 : 0] = guesses
  return moves
}

describe('Global Gank roles', () => {
  it('keeps one ganker all game: you in solo, the seed’s player in Multiplayer, both roles or not', () => {
    expect(gankerOf(solo)).toBe(0)
    expect(gankerOf(live())).toBe(firstPlayer(live()))
    expect(DESTINY_RULES.chances).toBe(1)
  })

  it('reads anything malformed as a gank mid', () => {
    expect(readGank(2)).toBe(2)
    expect(readGank(42)).toBe(TIMEOUT_GANK)
  })
})

describe('Global Gank scoring', () => {
  it('gives 2 to a right guess, otherwise 1 to the ganker', () => {
    const countered: DestinyHalf = { ganker: 0, lane: 1, guess: 1, countered: true }
    const through: DestinyHalf = { ganker: 0, lane: 1, guess: 2, countered: false }
    expect([halfScorer(countered), halfPoints(countered)]).toEqual([1, DESTINY_POINTS.counter])
    expect([halfScorer(through), halfPoints(through)]).toEqual([0, DESTINY_POINTS.gank])
  })

  it('reads each gank from both players’ moves, a missing guess guessing nothing', () => {
    const setup = live(3)
    const ganker = gankerOf(setup)
    const results = destinyResults(play(setup, [2, 0], [NO_GUESS, 0]), setup)
    expect(results).toEqual([
      { ganker, lane: 2, guess: null, countered: false },
      { ganker, lane: 0, guess: 0, countered: true },
    ])
    const points = destinyPoints(results)
    expect(points[ganker]).toBe(1)
    expect(points[ganker === 0 ? 1 : 0]).toBe(2)
  })

  it('settles after 5 ganks: 2 right guesses win it for the guesser, never a tie', () => {
    const setup = live(5)
    const ganker = gankerOf(setup)
    const guesser = ganker === 0 ? 1 : 0
    expect(DESTINY_RULES.settle(play(setup, [0, 1, 2, 0], [1, 1, 1, 1]), setup)).toBeNull()
    const oneRead = DESTINY_RULES.settle(play(setup, [0, 1, 2, 0, 1], [0, 0, 0, 1, 2]), setup)
    expect(oneRead?.winner).toBe(ganker)
    expect(oneRead?.scores[ganker]).toBe(4)
    const twoReads = DESTINY_RULES.settle(play(setup, [0, 1, 2, 0, 1], [0, 1, 0, 1, 2]), setup)
    expect(twoReads?.winner).toBe(guesser)
    expect(twoReads?.scores[guesser]).toBe(4)
    for (let reads = 0; reads <= DESTINY_GANKS; reads++) expect(reads * 2).not.toBe(DESTINY_GANKS - reads)
  })

  it('owes the gank first, then the guess', () => {
    const setup = live(9)
    const ganker = gankerOf(setup)
    expect(DESTINY_RULES.owed([[], []], setup)).toEqual([{ player: ganker, step: 0 }])
    expect(DESTINY_RULES.owed(play(setup, [0], []), setup)).toEqual([{ player: ganker === 0 ? 1 : 0, step: 0 }])
    expect(DESTINY_RULES.owed(play(setup, [0, 2], [1]), setup)).toEqual([{ player: ganker === 0 ? 1 : 0, step: 1 }])
  })

  it('fills in a gank mid, or no guess, for a player out of time', () => {
    const setup = live(9)
    const ganker = gankerOf(setup)
    expect(DESTINY_RULES.fallback({ player: ganker, step: 3 }, [[], []], setup)).toBe(TIMEOUT_GANK)
    expect(DESTINY_RULES.fallback({ player: ganker === 0 ? 1 : 0, step: 3 }, [[], []], setup)).toBe(NO_GUESS)
  })
})

describe('Global Gank bot', () => {
  it('knows the lane you gank most', () => {
    const ganks = (...lanes: (0 | 1 | 2)[]): DestinyHalf[] => lanes.map((lane) => ({ ganker: 0, lane, guess: null, countered: false }))
    expect(favoriteLane([])).toBeNull()
    expect(favoriteLane(ganks(0, 2, 2))).toBe(2)
    expect(favoriteLane(ganks(0, 1))).toBe(1)
  })

  it('guesses every gank, only after yours is in', () => {
    const mine: Moves = [0, 1, 2, 0, 1]
    const bot = botMoves(DESTINY_RULES, mine, solo)
    expect(bot).toHaveLength(DESTINY_GANKS)
    expect(DESTINY_RULES.settle([mine, bot], solo)).not.toBeNull()
    expect(DESTINY_RULES.botMove(0, [[], []], solo)).toBeUndefined()
  })

  it('is about a fair fight against random ganks', () => {
    let botWins = 0
    const games = 1000
    for (let seed = 1; seed <= games; seed++) {
      const setup = soloSetup(seed)
      const random = seededRandom(seed * 31 + 5)
      const mine: Moves = Array.from({ length: DESTINY_GANKS }, () => Math.floor(random() * 3))
      if (DESTINY_RULES.settle([mine, botMoves(DESTINY_RULES, mine, setup)], setup)?.winner === 1) botWins += 1
    }
    expect(botWins / games).toBeGreaterThan(0.4)
    expect(botWins / games).toBeLessThan(0.7)
  })
})
