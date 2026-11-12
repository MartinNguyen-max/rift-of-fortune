import { describe, expect, it } from 'vitest'
import { simulateLiveMatch } from '../match/simulateMatch'
import { sampleTeams } from '../match/testUtils'
import type { MatchTeams, Side } from '../match/types'
import { liveScript } from './liveEvents'
import { buildLiveReel, liveChances, liveTimeline, mirrorMatch } from './liveReel'

const teams = sampleTeams(5)
const SEED = 31
const winners: Side[] = ['blue', 'red', 'red', 'blue']
const matchAfter = (count: number) =>
  simulateLiveMatch(teams, SEED, { events: liveScript(SEED), winners: winners.slice(0, count) })
const swapped: MatchTeams = { blue: teams.red, red: teams.blue }

describe('buildLiveReel', () => {
  const full = matchAfter(4)
  const reel = buildLiveReel(full, teams)

  it('shows every live event as a big moment, and the ending', () => {
    for (const index of full.scripted) {
      const at = reel.sources.indexOf(index)
      expect(at).toBeGreaterThanOrEqual(0)
      expect(reel.events[at]?.big).toBe(true)
    }
    expect(reel.sources.at(-1)).toBe(full.events.length - 1)
    expect(reel.events.at(-1)?.big).toBe(true)
  })

  it('keeps the reel up to a live event the same once the match goes on', () => {
    for (let count = 0; count < 4; count++) {
      const before = buildLiveReel(matchAfter(count), teams)
      const after = buildLiveReel(matchAfter(count + 1), teams)
      expect(after.sources.slice(0, before.sources.length)).toEqual(before.sources)
      expect(after.events.slice(0, before.events.length)).toEqual(before.events)
    }
  })

  it('shows a handful of moments, in game order', () => {
    expect(reel.events.length).toBeGreaterThan(8)
    expect(reel.events.length).toBeLessThan(25)
    expect([...reel.sources].sort((a, b) => a - b)).toEqual(reel.sources)
  })
})

describe('mirrorMatch', () => {
  const full = matchAfter(4)
  const mirrored = mirrorMatch(full)

  it('swaps the sides of every event, kill and score', () => {
    full.events.forEach((event, index) => {
      const flipped = mirrored.events[index]
      expect(flipped?.side).not.toBe(event.side)
      expect(flipped?.score.blue).toEqual(event.score.red)
      flipped?.kills.forEach((kill, at) => expect(kill.killer.side).not.toBe(event.kills[at]?.killer.side))
    })
    expect(mirrored.winner).not.toBe(full.winner)
    expect(mirrored.stats.blue).toEqual(full.stats.red)
  })

  it('keeps Baron and Dragon in place but swaps the bases', () => {
    const spots = full.events.map(({ spot }) => spot)
    const flippedSpots = mirrored.events.map(({ spot }) => spot)
    spots.forEach((spot, index) => {
      if (spot === 'baron' || spot === 'dragon' || spot === 'mid') expect(flippedSpots[index]).toBe(spot)
      if (spot === 'blueBase') expect(flippedSpots[index]).toBe('redBase')
    })
  })

  it('mirrors the win chance too', () => {
    const chances = liveChances(full, teams)
    const mirroredChances = liveChances(mirrored, swapped)
    chances.forEach((chance, index) => expect(mirroredChances[index]).toBeCloseTo(1 - chance, 10))
  })
})

describe('liveTimeline', () => {
  it('gives big moments more time and never moves earlier moments', () => {
    const reel = buildLiveReel(matchAfter(4), teams)
    const timeline = liveTimeline(reel.events)
    const shorter = liveTimeline(reel.events.slice(0, 5))
    expect(timeline.starts.slice(0, 5)).toEqual(shorter.starts)
    expect(timeline.total).toBeGreaterThan(timeline.starts.at(-1) ?? 0)
  })
})
