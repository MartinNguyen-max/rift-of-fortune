import { describe, expect, it } from 'vitest'
import { ROLES } from '../roles'
import { commentate } from './commentary'
import { simulateMatch } from './simulateMatch'
import { dramaScore, FEEDER_VERBS, findMvp, matchShareText, matchStory, momentOfTheMatch, mostDeaths, standouts, summarizeMatch } from './summary'
import { winChanceTimeline } from './winChance'
import { emptyStats } from './stats'
import { makeEvent, sampleTeams } from './testUtils'
import type { MatchResult } from './types'

const teams = sampleTeams()

function fakeMatch(events: MatchResult['events'], winner: MatchResult['winner'] = 'blue'): MatchResult {
  const match = simulateMatch(teams, 3)
  return { ...match, winner, events }
}

describe('dramaScore', () => {
  it('ranks a pentakill and a Baron steal above a tower', () => {
    const tower = dramaScore(makeEvent({ kind: 'tower' }), 'blue')
    const penta = dramaScore(makeEvent({ kind: 'teamfight', tags: ['ace', 'pentakill'] }), 'blue')
    const steal = dramaScore(makeEvent({ kind: 'baron', tags: ['steal', 'upset'] }), 'blue')
    expect(penta).toBeGreaterThan(tower)
    expect(steal).toBeGreaterThan(tower)
  })

  it('never picks the Nexus or a surrender', () => {
    expect(dramaScore(makeEvent({ kind: 'nexus', big: true }), 'blue')).toBe(0)
    expect(dramaScore(makeEvent({ kind: 'surrender', big: true }), 'blue')).toBe(0)
  })
})

describe('momentOfTheMatch', () => {
  it('picks the most dramatic event', () => {
    const match = fakeMatch([
      makeEvent({ kind: 'tower', tags: ['firstTower'] }),
      makeEvent({ kind: 'baron', side: 'red', tags: ['steal', 'upset'] }),
      makeEvent({ kind: 'teamfight', tags: [] }),
      makeEvent({ kind: 'nexus' }),
    ])
    expect(momentOfTheMatch(match)).toBe(1)
  })

  it('returns null when nothing stood out', () => {
    expect(momentOfTheMatch(fakeMatch([makeEvent({ kind: 'nexus' })]))).toBeNull()
  })
})

describe('findMvp', () => {
  it('picks the best KDA on the winning team', () => {
    for (let seed = 0; seed < 20; seed++) {
      const match = simulateMatch(teams, seed)
      const mvp = findMvp(match)
      expect(mvp.side).toBe(match.winner)
      const kills = ROLES.map((role) => match.stats[match.winner][role].kills)
      expect(mvp.kda.kills + mvp.kda.assists).toBeGreaterThan(0)
      expect(Math.max(...kills)).toBeGreaterThanOrEqual(mvp.kda.kills)
    }
  })
})

describe('summarizeMatch', () => {
  it('prefers a draft roast as the best line', () => {
    const match = simulateMatch(teams, 1)
    const lines = commentate(match, teams).map((line, index) => (index === 2 ? { caster: 'analyst' as const, text: 'Roast', callback: true } : line && { ...line, callback: false }))
    expect(summarizeMatch(match, lines).bestLine).toBe(lines[2])
  })
})

describe('matchShareText', () => {
  it('shows the result, opponent, score, MVP and link', () => {
    const match = simulateMatch(teams, 1)
    const summary = summarizeMatch(match, commentate(match, teams))
    const text = matchShareText(match, teams, summary, 'Level 2', 'https://example.com/#/match')
    expect(text).toContain(match.winner === 'blue' ? 'Victory' : 'Defeat')
    expect(text).toContain('vs Team Bot (Level 2)')
    expect(text).toMatch(/Kills \d+–\d+/)
    expect(text).toContain('MVP: ')
    expect(text.endsWith('https://example.com/#/match')).toBe(true)
  })
})

describe('mostDeaths', () => {
  it('finds the champion who died the most on either team', () => {
    const stats = emptyStats()
    stats.blue.TOP.deaths = 3
    stats.red.SUPPORT.deaths = 5
    expect(mostDeaths(stats)).toEqual({ side: 'red', role: 'SUPPORT' })
  })

  it('is null when nobody died', () => {
    expect(mostDeaths(emptyStats())).toBeNull()
  })
})

describe('matchStory', () => {
  const stories = Array.from({ length: 60 }, (_, seed) => {
    const match = simulateMatch(teams, seed)
    const story = matchStory(match, teams, summarizeMatch(match, commentate(match, teams)))
    return { match, story, before: winChanceTimeline(match, teams)[0] ?? 0.5 }
  })

  it('is short: two sentences about the turn and who carried', () => {
    for (const { story } of stories) {
      expect(story.length).toBeLessThanOrEqual(170)
      expect(story).toContain('carried')
      expect(story).not.toMatch(/undefined|\s{2}/)
    }
  })

  it('points at the turning point when the underdog won', () => {
    const upsets = stories.filter(({ match, before }) => Math.abs(before - 0.5) >= 0.05 && (before >= 0.5 ? 'blue' : 'red') !== match.winner)
    expect(upsets.length).toBeGreaterThan(0)
    for (const { story } of upsets) expect(story).toMatch(/Then .+\. Oops\./)
  })

  it('names who fed, with their K/D/A', () => {
    const withFeeder = stories.filter(({ story }) => FEEDER_VERBS.some((verb) => story.includes(verb)))
    expect(withFeeder.length).toBeGreaterThan(stories.length / 2)
  })
})

describe('standouts', () => {
  it('finds the best and the worst player so far, on either team', () => {
    const stats = emptyStats()
    stats.red.MIDDLE = { kills: 9, deaths: 1, assists: 3 }
    stats.blue.SUPPORT = { kills: 0, deaths: 7, assists: 2 }
    expect(standouts(stats)).toEqual({ best: { side: 'red', role: 'MIDDLE' }, worst: { side: 'blue', role: 'SUPPORT' } })
  })

  it('has nobody to point at before the first kill', () => {
    expect(standouts(emptyStats())).toEqual({ best: null, worst: null })
  })
})
