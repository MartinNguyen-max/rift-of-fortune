import { describe, expect, it } from 'vitest'
import { buildHighlightReel, leadChanges, REEL, reelLength } from './highlights'
import { simulateMatch } from './simulateMatch'
import { sampleTeams } from './testUtils'
import { winChanceTimeline } from './winChance'

const teams = sampleTeams()
const matches = Array.from({ length: 40 }, (_, seed) => simulateMatch(teams, seed))

describe('buildHighlightReel', () => {
  it('shows a handful of moments in time order, ending with the end of the match', () => {
    for (const match of matches) {
      const { events, sources } = buildHighlightReel(match, teams)
      expect(events).toHaveLength(Math.min(reelLength(match, winChanceTimeline(match, teams)), match.events.length))
      expect(sources).toEqual([...sources].sort((a, b) => a - b))
      expect(sources.at(-1)).toBe(match.events.length - 1)
      for (const [index, event] of events.entries()) expect(event.time).toBe(match.events[sources[index] ?? -1]?.time)
    }
  })

  it('has the key moments plus the ending as its only big moments', () => {
    for (const match of matches) {
      const { events } = buildHighlightReel(match, teams)
      expect(events.filter(({ big }) => big)).toHaveLength(REEL.keyMoments + 1)
      expect(events.at(-1)?.big).toBe(true)
    }
  })

  it('picks the events that swung the win chance the most as key moments', () => {
    for (const match of matches) {
      const chances = winChanceTimeline(match, teams)
      const swing = (index: number) => Math.abs((chances[index + 1] ?? 0) - (chances[index] ?? 0))
      const { events, sources } = buildHighlightReel(match, teams)
      const keySwings = sources.filter((_, index) => events[index]?.big).slice(0, -1).map(swing)
      const others = match.events.slice(0, -1).map((_, index) => index).filter((index) => !sources.includes(index))
      for (const other of others) expect(swing(other)).toBeLessThanOrEqual(Math.min(...keySwings))
    }
  })

  it('always shows first blood', () => {
    for (const match of matches) {
      const firstBlood = match.events.findIndex(({ tags }) => tags.includes('firstBlood'))
      if (firstBlood >= 0) expect(buildHighlightReel(match, teams).sources).toContain(firstBlood)
    }
  })

  it('never changes the match itself', () => {
    const match = simulateMatch(teams, 5)
    const before = JSON.stringify(match)
    buildHighlightReel(match, teams)
    expect(JSON.stringify(match)).toBe(before)
  })
})

describe('leadChanges', () => {
  it('counts how often the favourite switched sides, ignoring the final result', () => {
    expect(leadChanges([0.6, 0.7, 0.4, 0.45, 0.55, 1])).toBe(2)
    expect(leadChanges([0.6, 0.8, 0.9, 0])).toBe(0)
  })
})

describe('reelLength', () => {
  it('shows a stomp in few moments and a long back-and-forth game in more', () => {
    const lengths = matches.map((match) => ({ match, length: reelLength(match, winChanceTimeline(match, teams)) }))
    for (const { length } of lengths) {
      expect(length).toBeGreaterThanOrEqual(REEL.minMoments)
      expect(length).toBeLessThanOrEqual(REEL.minMoments + REEL.lengthBonus + REEL.leadChangeBonus)
    }
    const short = lengths.filter(({ match }) => match.duration < 25 * 60).map(({ length }) => length)
    const long = lengths.filter(({ match }) => match.duration > 35 * 60).map(({ length }) => length)
    const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
    expect(short.length).toBeGreaterThan(0)
    expect(long.length).toBeGreaterThan(0)
    expect(average(long)).toBeGreaterThan(average(short) + 2)
  })
})
