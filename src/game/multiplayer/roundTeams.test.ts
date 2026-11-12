import { describe, expect, it } from 'vitest'
import { gameData } from '../../data'
import { seededRandom } from '../random'
import { completeTeam } from './completeTeam'
import { roundTeams, teamsFor } from './roundTeams'
import { encodeTeam } from './teamCode'

const hostTeam = encodeTeam(completeTeam(null, gameData, seededRandom(1)))
const guestTeam = encodeTeam(completeTeam(null, gameData, seededRandom(2)))
const players = [
  { id: 'host', name: 'Team Host' },
  { id: 'guest', name: 'Team Guest' },
]
const teams = roundTeams({ players, match: { seed: 5, teams: [hostTeam, guestTeam], startedAt: 0 } }, gameData)

describe('roundTeams', () => {
  it('puts the host on blue and the guest on red, with their names', () => {
    expect(teams?.blue.name).toBe('Team Host')
    expect(teams?.red.name).toBe('Team Guest')
    expect(teams?.blue.rating.champions[0]?.champion.id).toBe(hostTeam[0]?.champion)
  })

  it('is null before the match starts', () => {
    expect(roundTeams({ players, match: null }, gameData)).toBeNull()
  })

  it('makes a random team from the seed if a team is unreadable, the same for both players', () => {
    const broken = { players, match: { seed: 5, teams: [hostTeam, []], startedAt: 0 } }
    expect(roundTeams(broken, gameData)?.red.rating).toEqual(roundTeams(broken, gameData)?.red.rating)
  })
})

describe('teamsFor', () => {
  it('shows each player their own team on blue', () => {
    if (!teams) throw new Error('No teams')
    expect(teamsFor(teams, 'blue').blue.name).toBe('Team Host')
    expect(teamsFor(teams, 'red').blue.name).toBe('Team Guest')
    expect(teamsFor(teams, 'red').red.name).toBe('Team Host')
  })
})
