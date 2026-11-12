import { describe, expect, it } from 'vitest'
import {
  activeBigEvent,
  BEATS,
  buildTimeline,
  eventsShown,
  gameClock,
  LEAD_IN,
  liveScore,
  MATCH_SECONDS,
} from './playback'
import { simulateMatch } from './simulateMatch'
import { makeEvent, sampleTeams } from './testUtils'

const events = [
  makeEvent({ time: 150 }),
  makeEvent({ time: 200, big: true }),
  makeEvent({ time: 260 }),
  makeEvent({ time: 400, big: true }),
]
const timeline = buildTimeline(events)

describe('buildTimeline', () => {
  it('fits every match into the same watch time', () => {
    expect(timeline.total).toBe(MATCH_SECONDS)
    const teams = sampleTeams()
    for (let seed = 0; seed < 20; seed++) {
      const match = simulateMatch(teams, seed)
      const { starts, total } = buildTimeline(match.events)
      expect(total).toBe(MATCH_SECONDS)
      expect(starts).toHaveLength(match.events.length)
      expect(starts.at(-1)).toBeLessThan(MATCH_SECONDS)
    }
  })

  it('gives big moments more time than small ones', () => {
    const [a = 0, b = 0, c = 0] = timeline.starts
    expect(a).toBe(LEAD_IN)
    expect((c - b) / (b - a)).toBeCloseTo(BEATS.big / BEATS.small)
  })
})

describe('eventsShown', () => {
  it('counts the events that have appeared', () => {
    expect(eventsShown(timeline, 0)).toBe(0)
    expect(eventsShown(timeline, LEAD_IN)).toBe(1)
    expect(eventsShown(timeline, MATCH_SECONDS)).toBe(4)
  })
})

describe('activeBigEvent', () => {
  it('is the big event whose beat is playing', () => {
    const [, bigStart = 0, nextStart = 0] = timeline.starts
    expect(activeBigEvent(events, timeline, LEAD_IN + 0.01)).toBeNull()
    expect(activeBigEvent(events, timeline, bigStart + 0.01)).toBe(1)
    expect(activeBigEvent(events, timeline, nextStart + 0.01)).toBeNull()
    expect(activeBigEvent(events, timeline, MATCH_SECONDS - 0.01)).toBe(3)
    expect(activeBigEvent(events, timeline, MATCH_SECONDS)).toBeNull()
  })
})

describe('gameClock', () => {
  it('starts a minute before the first event and reaches each event on time', () => {
    expect(gameClock(events, timeline, 0)).toBe(90)
    for (const [index, event] of events.entries()) {
      expect(gameClock(events, timeline, timeline.starts[index] ?? 0)).toBeCloseTo(event.time)
    }
    expect(gameClock(events, timeline, MATCH_SECONDS + 5)).toBe(400)
  })

  it('never runs backwards', () => {
    let last = 0
    for (let elapsed = 0; elapsed <= MATCH_SECONDS; elapsed += 0.1) {
      const clock = gameClock(events, timeline, elapsed)
      expect(clock).toBeGreaterThanOrEqual(last)
      last = clock
    }
  })
})

describe('liveScore', () => {
  it('shows the last event score plus passive gold since then', () => {
    const score = liveScore(events, 2, 200 + 60)
    expect(score.blue.gold).toBe((events[1]?.score.blue.gold ?? 0) + 1700)
    expect(score.blue.kills).toBe(0)
  })

  it('starts with the starting gold before any event', () => {
    expect(liveScore(events, 0, 0).red.gold).toBe(2500)
  })
})
