import { describe, expect, it } from 'vitest'
import { pickRandom, sample } from './random'

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
