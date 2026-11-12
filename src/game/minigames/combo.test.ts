import { describe, expect, it } from 'vitest'
import { botComboBest, checkCombo, COMBO_MAX_LENGTH, comboSpam, flashSeconds, inputSeconds, toComboKey } from './combo'

describe('comboSpam', () => {
  it('is the same for the same seed, only Q W E R', () => {
    expect(comboSpam(5)).toEqual(comboSpam(5))
    expect(comboSpam(5)).toHaveLength(COMBO_MAX_LENGTH)
    expect(comboSpam(5).every((key) => ['Q', 'W', 'E', 'R'].includes(key))).toBe(true)
  })
})

describe('checkCombo', () => {
  const spam = ['Q', 'Q', 'E', 'R', 'W'] as const

  it('is ok while every typed key matches', () => {
    expect(checkCombo(spam, 4, ['Q', 'Q'])).toBe('ok')
  })

  it('is complete when the round length is typed correctly', () => {
    expect(checkCombo(spam, 4, ['Q', 'Q', 'E', 'R'])).toBe('complete')
  })

  it('is wrong at the first wrong key', () => {
    expect(checkCombo(spam, 4, ['Q', 'W'])).toBe('wrong')
  })
})

describe('timing', () => {
  it('shows keys faster as the spam grows, never faster than 0.32 s', () => {
    expect(flashSeconds(3)).toBeGreaterThan(flashSeconds(8))
    expect(flashSeconds(30)).toBe(0.32)
  })

  it('gives more input time for longer spam', () => {
    expect(inputSeconds(8)).toBeGreaterThan(inputSeconds(3))
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

describe('botComboBest', () => {
  it('remembers 4 to 11 keys, mostly in the middle', () => {
    const results = Array.from({ length: 300 }, (_, seed) => botComboBest(seed))
    expect(Math.min(...results)).toBeGreaterThanOrEqual(4)
    expect(Math.max(...results)).toBeLessThanOrEqual(11)
    const average = results.reduce((sum, value) => sum + value, 0) / results.length
    expect(average).toBeGreaterThan(6.5)
    expect(average).toBeLessThan(8.5)
  })
})
