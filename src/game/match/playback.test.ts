import { describe, expect, it } from 'vitest'
import { eventsShown, GAME_SECONDS_PER_SECOND, LEAD_IN, liveScore, secondsLeft, startTime } from './playback'
import { simulateMatch } from './simulateMatch'
import { makeEvent, sampleTeams } from './testUtils'

const events = [makeEvent({ time: 150 }), makeEvent({ time: 200 }), makeEvent({ time: 200 }), makeEvent({ time: 400 })]

describe('startTime', () => {
  it('starts a little before the first event', () => {
    expect(startTime(events)).toBe(150 - LEAD_IN)
    expect(startTime([])).toBe(0)
  })
})

describe('eventsShown', () => {
  it('counts the events up to and including the clock', () => {
    expect(eventsShown(events, 100)).toBe(0)
    expect(eventsShown(events, 150)).toBe(1)
    expect(eventsShown(events, 399)).toBe(3)
    expect(eventsShown(events, 400)).toBe(4)
  })
})

describe('secondsLeft', () => {
  it('converts game time left into real seconds', () => {
    expect(secondsLeft(1000, 400, 1)).toBe(600 / GAME_SECONDS_PER_SECOND)
    expect(secondsLeft(1000, 400, 2)).toBe(600 / GAME_SECONDS_PER_SECOND / 2)
    expect(secondsLeft(1000, 1200, 1)).toBe(0)
  })

  it('keeps an average match at 1× between 1 and 2 minutes', () => {
    const teams = sampleTeams()
    const lengths = Array.from({ length: 200 }, (_, seed) => {
      const match = simulateMatch(teams, seed)
      return secondsLeft(match.duration, startTime(match.events), 1)
    })
    const average = lengths.reduce((sum, value) => sum + value, 0) / lengths.length
    expect(average).toBeGreaterThan(60)
    expect(average).toBeLessThan(120)
  })
})

describe('liveScore', () => {
  it('shows the last event score plus passive gold since then', () => {
    const score = liveScore(events, 200 + 60)
    expect(score.blue.gold).toBe((events[2]?.score.blue.gold ?? 0) + 1700)
    expect(score.blue.kills).toBe(0)
  })

  it('starts with the starting gold before any event', () => {
    expect(liveScore(events, 0).red.gold).toBe(2500)
  })
})
