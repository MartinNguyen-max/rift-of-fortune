import { describe, expect, it } from 'vitest'
import type { Champion } from '../data/types'
import { emptyRoles, emptyTeam, isTeamComplete } from './team'

const champion: Champion = {
  id: 'Ahri',
  name: 'Ahri',
  title: '',
  image: '',
  classes: ['Mage'],
  positions: ['MIDDLE'],
  damageType: 'AP',
  attackType: 'RANGED',
}

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
