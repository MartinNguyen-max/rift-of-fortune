import { describe, expect, it } from 'vitest'
import { NO_STOP, runOutcome, secondsTo, type RaceTrack } from '../../game/minigames/race'
import { describeStop, laneShare, runCall } from './raceScreen'

const track: RaceTrack = { target: 60, tower: 75, start: 10, accel: 8 }
const tapAt = (offset: number) => Math.round(secondsTo(track, track.target + offset) * 1000)
const callAt = (offset: number) => runCall(runOutcome(track, tapAt(offset)))

describe('race screen', () => {
  it('draws the start a little in and the tower near the end', () => {
    expect(laneShare(track, 0)).toBeCloseTo(0.05)
    expect(laneShare(track, track.tower)).toBeGreaterThan(0.8)
    expect(laneShare(track, 999)).toBeLessThanOrEqual(0.93)
  })

  it('names each stop', () => {
    expect(callAt(0)).toBe('bullseye')
    expect(callAt(4)).toBe('zone')
    expect(callAt(-10)).toBe('short')
    expect(callAt(10)).toBe('long')
    expect(callAt(20)).toBe('crash')
    expect(runCall(runOutcome(track, NO_STOP))).toBe('crash')
    expect(describeStop(runOutcome(track, tapAt(-10)))).toMatch(/^\d+\.\d m short$/)
    expect(describeStop(runOutcome(track, tapAt(20)))).toBe('hit the tower')
  })
})
