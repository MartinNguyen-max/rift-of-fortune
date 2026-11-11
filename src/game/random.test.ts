import { describe, expect, it } from 'vitest'
import { pickRandom, sample, seededRandom, seedFromString } from './random'

describe('pickRandom', () => {
  it('maps the random value onto the list', () => {
    expect(pickRandom(['a', 'b', 'c'], () => 0)).toBe('a')
    expect(pickRandom(['a', 'b', 'c'], () => 0.99)).toBe('c')
  })

  it('throws on an empty list', () => {
    expect(() => pickRandom([], () => 0)).toThrow()
  })
})

describe('sample', () => {
  it('returns distinct entries', () => {
    const result = sample([1, 2, 3, 4, 5, 6], 4)
    expect(result).toHaveLength(4)
    expect(new Set(result).size).toBe(4)
  })

  it('never returns more entries than the list has', () => {
    expect(sample([1, 2], 5)).toHaveLength(2)
  })
})

describe('seededRandom', () => {
  it('gives the same sequence for the same seed', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('stays within [0, 1)', () => {
    const random = seededRandom(7)
    for (let i = 0; i < 1000; i++) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('seedFromString', () => {
  it('is stable and differs between inputs', () => {
    expect(seedFromString('2026-11-11')).toBe(seedFromString('2026-11-11'))
    expect(seedFromString('2026-11-11')).not.toBe(seedFromString('2026-11-12'))
  })
})
