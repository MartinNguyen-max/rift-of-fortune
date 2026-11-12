import { describe, expect, it } from 'vitest'
import { ROLES } from '../roles'
import { simulateMatch } from './simulateMatch'
import { statsAfter } from './stats'
import { makeEvent, sampleTeams } from './testUtils'
import { SIDES } from './types'

describe('statsAfter', () => {
  it('adds up kills, deaths and assists from each kill', () => {
    const events = [
      makeEvent({ kills: [{ killer: { side: 'blue', role: 'MIDDLE' }, victim: { side: 'red', role: 'TOP' }, assists: ['JUNGLE'] }] }),
      makeEvent({ kills: [{ killer: { side: 'red', role: 'TOP' }, victim: { side: 'blue', role: 'MIDDLE' }, assists: [] }] }),
    ]
    const stats = statsAfter(events, 1)
    expect(stats.blue.MIDDLE).toEqual({ kills: 1, deaths: 0, assists: 0 })
    expect(stats.blue.JUNGLE.assists).toBe(1)
    expect(stats.red.TOP.deaths).toBe(1)
    expect(statsAfter(events).blue.MIDDLE.deaths).toBe(1)
  })

  it('matches the scoreboard kills after every event of a real match', () => {
    const teams = sampleTeams()
    for (let seed = 0; seed < 20; seed++) {
      const match = simulateMatch(teams, seed)
      for (const [index, event] of match.events.entries()) {
        const stats = statsAfter(match.events, index + 1)
        for (const side of SIDES) {
          const kills = ROLES.reduce((sum, role) => sum + stats[side][role].kills, 0)
          const deaths = ROLES.reduce((sum, role) => sum + stats[side === 'blue' ? 'red' : 'blue'][role].deaths, 0)
          expect(kills).toBe(event.score[side].kills)
          expect(deaths).toBe(kills)
        }
      }
    }
  })
})
