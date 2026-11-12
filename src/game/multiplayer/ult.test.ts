import { describe, expect, it } from 'vitest'
import { markerAt, ULT, ULT_ZONES, ultBar, ultScore, type UltBar } from './ult'

const bar: UltBar = { zoneCenter: 0.5, speed: 0.6 }

/** The first moment the marker reaches `position`. */
function timeAt(position: number): number {
  for (let time = 0; time < ULT.seconds; time += 0.0005) if (markerAt(bar, time) >= position) return time
  throw new Error('Never reached')
}

describe('ultBar', () => {
  it('is the same for both players with the same seed, with the zone away from the edges', () => {
    expect(ultBar(4)).toEqual(ultBar(4))
    for (let seed = 0; seed < 100; seed++) {
      const { zoneCenter } = ultBar(seed)
      expect(zoneCenter).toBeGreaterThanOrEqual(0.3)
      expect(zoneCenter).toBeLessThanOrEqual(0.7)
    }
  })
})

describe('markerAt', () => {
  it('starts a little in from the left edge and stays on the bar', () => {
    expect(markerAt(bar, 0)).toBe(ULT.start)
    for (let time = 0; time < ULT.seconds; time += 0.05) {
      const position = markerAt(bar, time)
      expect(position).toBeGreaterThanOrEqual(0)
      expect(position).toBeLessThanOrEqual(1)
    }
  })

  it('speeds up over time', () => {
    const step = 0.01
    const speedAt = (time: number) => Math.abs(markerAt(bar, time + step) - markerAt(bar, time)) / step
    expect(speedAt(6.2)).toBeGreaterThan(speedAt(0.2))
  })

  it('crosses the zone a few times before time runs out', () => {
    let crossings = 0
    for (let time = 0.01; time < ULT.seconds; time += 0.01) {
      const before = markerAt(bar, time - 0.01) - bar.zoneCenter
      const after = markerAt(bar, time) - bar.zoneCenter
      if (before * after <= 0) crossings += 1
    }
    expect(crossings).toBeGreaterThanOrEqual(5)
  })
})

describe('ultScore', () => {
  it('scores 100 in the perfect band', () => {
    expect(ultScore(bar, timeAt(0.5))).toBe(100)
    expect(ultScore(bar, timeAt(0.5 - ULT_ZONES.perfect + 0.005))).toBe(100)
  })

  it('scores less the further from the middle', () => {
    const great = ultScore(bar, timeAt(0.5 - ULT_ZONES.great))
    const good = ultScore(bar, timeAt(0.5 - ULT_ZONES.good))
    expect(great).toBeLessThan(100)
    expect(good).toBeLessThan(great)
    expect(good).toBeGreaterThan(50)
  })

  it('gives any press in time at least 10, so 0–0 duels are rare', () => {
    const farBar = { zoneCenter: 0.7, speed: 0.6 }
    expect(ultScore(farBar, 0)).toBe(ULT_ZONES.min.score)
    expect(ultScore(bar, 0)).toBeGreaterThanOrEqual(ULT_ZONES.min.score)
  })

  it('scores 0 after the time limit or without a press', () => {
    expect(ultScore(bar, ULT.seconds + 0.1)).toBe(0)
    expect(ultScore(bar, null)).toBe(0)
  })
})
