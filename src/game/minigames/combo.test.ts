import { describe, expect, it } from 'vitest'
import {
  botRightKeys,
  COMBO_LENGTHS,
  COMBO_MAX_SCORE,
  COMBO_RULES,
  comboSpams,
  comboTotal,
  flashSeconds,
  inputSeconds,
  rightKeys,
  toComboKey,
} from './combo'
import { soloSetup, type BothMoves } from './versus'

const setup = soloSetup(5)

describe('comboSpams', () => {
  it('is three spams of 3, 5 and 7 keys, the same for the same seed, only Q W E R', () => {
    const spams = comboSpams(5)
    expect(spams).toEqual(comboSpams(5))
    expect(spams.map((spam) => spam.length)).toEqual([3, 5, 7])
    expect(spams.flat().every((key) => ['Q', 'W', 'E', 'R'].includes(key))).toBe(true)
  })

  it('never makes a spam the one before with keys added', () => {
    for (let seed = 0; seed < 500; seed++) {
      const [first, second, third] = comboSpams(seed)
      expect(second?.[0]).not.toBe(first?.[0])
      expect(third?.[0]).not.toBe(second?.[0])
    }
  })
})

describe('rightKeys', () => {
  it('counts every key in the right spot, also after a mistake', () => {
    expect(rightKeys(['Q', 'W', 'E'], ['Q', 'R', 'E'])).toBe(2)
    expect(rightKeys(['Q', 'W', 'E'], ['Q'])).toBe(1)
    expect(rightKeys(['Q', 'W', 'E'], [])).toBe(0)
  })
})

describe('timing', () => {
  it('shows keys a little faster in the longer spams: 0.6, 0.55 and 0.5 s', () => {
    expect(COMBO_LENGTHS.map(flashSeconds)).toEqual([0.6, 0.55, 0.5])
  })

  it('gives more input time for longer spam', () => {
    expect(inputSeconds(7)).toBeGreaterThan(inputSeconds(3))
  })

  it('gives Multiplayer time for all three spams', () => {
    const typing = COMBO_LENGTHS.reduce((total, length) => total + inputSeconds(length), 0)
    expect(COMBO_RULES.liveSeconds({ ...setup, variant: 'live' })).toBeGreaterThan(typing + 15)
  })
})

describe('toComboKey', () => {
  it('reads q w e r in any case and ignores other keys', () => {
    expect(toComboKey('q')).toBe('Q')
    expect(toComboKey('R')).toBe('R')
    expect(toComboKey('x')).toBeNull()
    expect(toComboKey('Enter')).toBeNull()
  })
})

describe('scoring', () => {
  it('adds the right keys of all three spams; the most wins', () => {
    const moves: BothMoves = [
      [3, 4, 5],
      [3, 5, 3],
    ]
    expect(comboTotal(moves[0])).toBe(12)
    expect(COMBO_RULES.settle(moves, setup)).toEqual({ winner: 0, scores: [12, 11] })
  })

  it('waits for every spam, one owed at a time', () => {
    const moves: BothMoves = [[3, 4], [3]]
    expect(COMBO_RULES.settle(moves, setup)).toBeNull()
    expect(COMBO_RULES.owed(moves, setup)).toEqual([
      { player: 0, step: 2 },
      { player: 1, step: 1 },
    ])
  })

  it('calls equal scores a tie', () => {
    expect(COMBO_RULES.settle([[3, 5, 7], [3, 5, 7]], setup)?.winner).toBeNull()
  })

  it('keeps the total as the personal best once all three are played', () => {
    expect(COMBO_RULES.best?.of([[3, 5, 6], []], setup)).toBe(14)
    expect(COMBO_RULES.best?.of([[3, 5], []], setup)).toBeNull()
    expect(COMBO_RULES.formatScore(14, setup)).toBe(`14 / ${COMBO_MAX_SCORE} keys`)
  })
})

describe('botRightKeys', () => {
  it('stays within each spam and gets about 12 to 13 of 15 on average', () => {
    const totals = Array.from({ length: 400 }, (_, seed) =>
      COMBO_LENGTHS.reduce((total, length, round) => {
        const keys = botRightKeys(seed, round)
        expect(keys).toBeGreaterThanOrEqual(0)
        expect(keys).toBeLessThanOrEqual(length)
        return total + keys
      }, 0),
    )
    const average = totals.reduce((sum, value) => sum + value, 0) / totals.length
    expect(average).toBeGreaterThan(11.5)
    expect(average).toBeLessThan(13.5)
    expect(Math.min(...totals)).toBeLessThan(11)
  })
})
