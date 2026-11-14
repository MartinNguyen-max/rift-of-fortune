import { describe, expect, it } from 'vitest'
import { holdFor, NO_RUN, runOutcome, type RaceTrack } from '../../game/minigames/race'
import { describeStop, laneShare, runCall, slideAt, slideDuration } from './raceScreen'

const track: RaceTrack = { target: 60, tower: 75, boost: 8, surge: 2.5 }
const holdTo = (offset: number) => Math.round(holdFor(track, track.target + offset) * 1000)

describe('race screen', () => {
  it('draws the start a little in and the tower near the end', () => {
    expect(laneShare(track, 0)).toBeCloseTo(0.05)
    expect(laneShare(track, track.tower)).toBeGreaterThan(0.8)
    expect(laneShare(track, 999)).toBeLessThanOrEqual(0.93)
  })

  it('slides to the stop of the run, and ends there', () => {
    const hold = holdTo(-3)
    const end = slideDuration(track, hold / 1000)
    expect(slideAt(track, hold / 1000, end).position).toBeCloseTo(runOutcome(track, hold).stop, 1)
    expect(slideAt(track, hold / 1000, end + 1).speed).toBe(0)
  })

  it('ends the slide at the tower for a crash', () => {
    const hold = holdTo(20)
    const end = slideDuration(track, hold / 1000)
    expect(end).toBeLessThan(slideAt(track, hold / 1000, 0).speed / 22)
    expect(slideAt(track, hold / 1000, end).position).toBeCloseTo(track.tower, 1)
  })

  it('names each stop', () => {
    expect(runCall(runOutcome(track, holdTo(0)), holdTo(0))).toBe('bullseye')
    expect(runCall(runOutcome(track, holdTo(4)), holdTo(4))).toBe('zone')
    expect(runCall(runOutcome(track, holdTo(-10)), holdTo(-10))).toBe('short')
    expect(runCall(runOutcome(track, holdTo(10)), holdTo(10))).toBe('long')
    expect(runCall(runOutcome(track, holdTo(20)), holdTo(20))).toBe('crash')
    expect(runCall(runOutcome(track, NO_RUN), NO_RUN)).toBe('none')
    expect(describeStop(runOutcome(track, holdTo(-10)))).toMatch(/^\d+\.\d m short$/)
    expect(describeStop(runOutcome(track, holdTo(20)))).toBe('hit the tower')
  })
})
