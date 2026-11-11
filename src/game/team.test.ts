import { describe, expect, it } from 'vitest'
import { emptyRoles, emptyTeam, isTeamComplete } from './team'
import { makeChampion } from './testUtils'

const champion = makeChampion()

describe('team', () => {
  it('starts with all five roles empty', () => {
    expect(emptyRoles(emptyTeam())).toEqual(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'])
  })

  it('is complete only when every role has a champion', () => {
    const team = { ...emptyTeam(), MIDDLE: champion }
    expect(isTeamComplete(team)).toBe(false)
    expect(emptyRoles(team)).not.toContain('MIDDLE')
    const full = { TOP: champion, JUNGLE: champion, MIDDLE: champion, BOTTOM: champion, SUPPORT: champion }
    expect(isTeamComplete(full)).toBe(true)
  })
})
