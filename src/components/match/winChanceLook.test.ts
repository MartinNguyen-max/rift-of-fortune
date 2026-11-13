import { describe, expect, it } from 'vitest'
import { barShare, swingOf, wobbleOf } from './winChanceLook'

describe('barShare', () => {
  it('exaggerates a lead but keeps the favourite on the right side and the ends fixed', () => {
    expect(barShare(0.5)).toBe(0.5)
    expect(barShare(0.6)).toBeGreaterThan(0.6)
    expect(barShare(0.4)).toBeLessThan(0.4)
    expect(barShare(0.4)).toBeCloseTo(1 - barShare(0.6))
    expect(barShare(1)).toBe(1)
    expect(barShare(0)).toBe(0)
  })
})

describe('wobbleOf', () => {
  it('wobbles most in a close game', () => {
    expect(wobbleOf(0.5)).toBeGreaterThan(wobbleOf(0.8))
    expect(wobbleOf(0.95)).toBeGreaterThan(0)
  })
})

describe('swingOf', () => {
  it('shows swings of 5 points or more, for the side that gained', () => {
    expect(swingOf([0.5, 0.62])).toEqual({ side: 'blue', points: 12 })
    expect(swingOf([0.5, 0.41])).toEqual({ side: 'red', points: 9 })
    expect(swingOf([0.5, 0.53])).toBeNull()
    expect(swingOf([0.5])).toBeNull()
  })
})
