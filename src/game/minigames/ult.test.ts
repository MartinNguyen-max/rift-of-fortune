import { describe, expect, it } from 'vitest'
import {
  barOfStep,
  botPress,
  markerAt,
  NO_PRESS,
  ULT,
  ULT_RULES,
  ULT_ZONES,
  ultBar,
  ultBars,
  ultScore,
  ultScoreOfMove,
  zoneCrossings,
  type UltBar,
} from './ult'
import { soloSetup, type GameSetup } from './versus'

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

describe('ULT_RULES', () => {
  const solo = soloSetup(5)
  const live: GameSetup = { seed: 5, variant: 'live', bothRoles: false, late: false }
  const perfect = (setup: GameSetup, step: number) => Math.round((zoneCrossings(barOfStep(setup, step))[0] ?? 0) * 1000)

  it('plays 3 bars solo and 1 live', () => {
    expect(ultBars(solo)).toBe(3)
    expect(ultBars(live)).toBe(1)
  })

  it('adds up the bars; the higher total wins', () => {
    const mine = [0, 1, 2].map((step) => perfect(solo, step))
    expect(ULT_RULES.settle([mine, [NO_PRESS, NO_PRESS]], solo)).toBeNull()
    const settled = ULT_RULES.settle([mine, [NO_PRESS, NO_PRESS, NO_PRESS]], solo)
    expect(settled).toEqual({ winner: 0, scores: [300, 0] })
  })

  it('is a tie with the same scores', () => {
    expect(ULT_RULES.settle([[perfect(live, 0)], [perfect(live, 0)]], live)?.winner).toBeNull()
  })

  it('has a decent bot: most presses score well, few are perfect', () => {
    const scores = Array.from({ length: 300 }, (_, seed) => {
      const bar = barOfStep(soloSetup(seed), 0)
      return ultScoreOfMove(bar, botPress(bar, seed))
    })
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
    expect(average).toBeGreaterThan(55)
    expect(average).toBeLessThan(90)
    expect(scores.filter((score) => score === 100).length / scores.length).toBeLessThan(0.5)
  })
})
