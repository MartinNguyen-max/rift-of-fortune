import { describe, expect, it } from 'vitest'
import { LIVE_EVENT_POINTS, pointsPerEvent, pointsTimeline, pointsVerdict, SURE_WIN_LEAD, sureWinner } from './points'

describe('pointsPerEvent', () => {
  it('splits the live-event points evenly', () => {
    expect(pointsPerEvent(3)).toBe(10)
    expect(pointsPerEvent(5)).toBe(6)
    expect(pointsPerEvent(1)).toBe(LIVE_EVENT_POINTS)
  })

  it('is 0 without live events', () => {
    expect(pointsPerEvent(0)).toBe(0)
  })
})

describe('pointsTimeline', () => {
  it('starts at the rounded team ratings and adds the prize to each event winner', () => {
    expect(pointsTimeline({ blue: 59.4, red: 80.2 }, ['blue', 'red'], 3)).toEqual([
      { blue: 59, red: 80 },
      { blue: 69, red: 80 },
      { blue: 69, red: 90 },
    ])
  })

  it('is just the start without played events', () => {
    expect(pointsTimeline({ blue: 50, red: 60 }, [], 3)).toEqual([{ blue: 50, red: 60 }])
  })
})

describe('sureWinner', () => {
  it('names the side with a big lead', () => {
    expect(sureWinner({ blue: 80, red: 80 - SURE_WIN_LEAD })).toBe('blue')
    expect(sureWinner({ blue: 50, red: 50 + SURE_WIN_LEAD })).toBe('red')
  })

  it('leaves a close game open', () => {
    expect(sureWinner({ blue: 70, red: 70 - SURE_WIN_LEAD + 1 })).toBeNull()
    expect(sureWinner({ blue: 64, red: 64 })).toBeNull()
  })
})

describe('pointsVerdict', () => {
  it('calls a big lead a sure win', () => {
    expect(pointsVerdict({ blue: 90, red: 60 }, 'blue')).toBe('sure')
  })

  it('tells a close win by the team ahead from an upset', () => {
    expect(pointsVerdict({ blue: 75, red: 70 }, 'blue')).toBe('held')
    expect(pointsVerdict({ blue: 75, red: 70 }, 'red')).toBe('upset')
  })

  it('calls equal points even', () => {
    expect(pointsVerdict({ blue: 70, red: 70 }, 'red')).toBe('even')
  })
})
