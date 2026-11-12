import { describe, expect, it } from 'vitest'
import { markerAt, ULT, ultBar, ultScore, type UltBar } from './ult'

const bar: UltBar = { zoneCenter: 0.5, speed: 1 }

describe('ultBar', () => {
  it('is the same for both players with the same seed, with the zone away from the edges', () => {
    expect(ultBar(4)).toEqual(ultBar(4))
    for (let seed = 0; seed < 100; seed++) {
      const { zoneCenter } = ultBar(seed)
      expect(zoneCenter).toBeGreaterThanOrEqual(0.25)
      expect(zoneCenter).toBeLessThanOrEqual(0.75)
    }
  })
})

describe('markerAt', () => {
  it('starts at the left and bounces between both ends', () => {
    expect(markerAt(bar, 0)).toBe(0)
    for (let time = 0; time < ULT.seconds; time += 0.05) {
      const position = markerAt(bar, time)
      expect(position).toBeGreaterThanOrEqual(0)
      expect(position).toBeLessThanOrEqual(1)
    }
  })

  it('speeds up over time', () => {
    const step = 0.01
    const speedAt = (time: number) => Math.abs(markerAt(bar, time + step) - markerAt(bar, time)) / step
    expect(speedAt(4.1)).toBeGreaterThan(speedAt(0.1))
  })
})

describe('ultScore', () => {
  /** The first moment the marker crosses the zone center. */
  const center = (() => {
    for (let time = 0; time < ULT.seconds; time += 0.0005) if (markerAt(bar, time) >= bar.zoneCenter) return time
    return 0
  })()

  it('scores 100 in the middle of the zone', () => {
    expect(ultScore(bar, center)).toBeGreaterThanOrEqual(99)
  })

  it('scores at least 60 anywhere in the zone, and less outside it', () => {
    const nearEdge = { zoneCenter: 0.5 - ULT.zoneHalfWidth + 0.002, speed: 1 }
    expect(ultScore(nearEdge, center)).toBeGreaterThanOrEqual(60)
    expect(ultScore(nearEdge, center)).toBeLessThanOrEqual(62)
    const outside = { zoneCenter: 0.5 - ULT.zoneHalfWidth - 0.05, speed: 1 }
    expect(ultScore(outside, center)).toBeLessThan(60)
  })

  it('scores 0 far from the zone, after the time limit, or without a press', () => {
    expect(ultScore(bar, 0)).toBe(0)
    expect(ultScore(bar, ULT.seconds + 0.1)).toBe(0)
    expect(ultScore(bar, null)).toBe(0)
  })
})
