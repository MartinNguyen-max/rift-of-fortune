import { describe, expect, it } from 'vitest'
import type { Role } from '../../data/types'
import { ROLES } from '../roles'
import { makeChampion } from '../testUtils'
import { LANE_SWAP_SCORE, ROLE_FIT_BANDS, ROLE_FIT_SCORE } from './config'
import { isOnRole, scoreRoleFit } from './roleFit'

const ahri = makeChampion({ id: 'Ahri', classes: ['Mage', 'Assassin'], positions: ['MIDDLE'] })
const janna = makeChampion({ id: 'Janna', classes: ['Support', 'Mage'], positions: ['SUPPORT'] })
const malphite = makeChampion({ id: 'Malphite', classes: ['Tank', 'Mage'], positions: ['TOP', 'SUPPORT'] })
const leeSin = makeChampion({ id: 'LeeSin', classes: ['Fighter', 'Assassin'], positions: ['JUNGLE'] })
const lucian = makeChampion({ id: 'Lucian', classes: ['Marksman'], positions: ['BOTTOM'] })

describe('scoreRoleFit', () => {
  it('gives full marks in the main role', () => {
    expect(scoreRoleFit(malphite, 'TOP')).toEqual({ kind: 'mainRole', score: ROLE_FIT_SCORE.mainRole, usualRole: 'TOP' })
  })

  it('gives a little less in a secondary role', () => {
    expect(scoreRoleFit(malphite, 'SUPPORT')).toMatchObject({
      kind: 'secondaryRole',
      score: ROLE_FIT_SCORE.secondaryRole,
    })
  })

  it('treats a mid laner in top as a reasonable swap', () => {
    expect(scoreRoleFit(ahri, 'TOP')).toMatchObject({ kind: 'closeFit', score: LANE_SWAP_SCORE.MIDDLE.TOP })
  })

  it('treats an ADC in mid as a reasonable swap', () => {
    expect(scoreRoleFit(lucian, 'MIDDLE')).toMatchObject({ kind: 'closeFit', score: LANE_SWAP_SCORE.BOTTOM.MIDDLE })
  })

  it('treats a support in the jungle as a disaster', () => {
    expect(scoreRoleFit(janna, 'JUNGLE')).toMatchObject({ kind: 'offRole', score: LANE_SWAP_SCORE.SUPPORT.JUNGLE })
  })

  it('treats a jungler as ADC as a disaster', () => {
    expect(scoreRoleFit(leeSin, 'BOTTOM')).toMatchObject({ kind: 'offRole', usualRole: 'JUNGLE' })
  })

  it('rates a mid laner in top far above a support in the jungle', () => {
    expect(scoreRoleFit(ahri, 'TOP').score).toBeGreaterThan(scoreRoleFit(janna, 'JUNGLE').score + 30)
  })

  it('uses the class fit as a minimum', () => {
    const rammus = makeChampion({ classes: ['Tank'], positions: ['JUNGLE'] })
    expect(scoreRoleFit(rammus, 'SUPPORT')).toMatchObject({ kind: 'stretch', score: ROLE_FIT_SCORE.classFit })
  })

  it('uses the best swap among all of the champion’s roles', () => {
    const flexPick = makeChampion({ classes: ['Mage'], positions: ['SUPPORT', 'MIDDLE'] })
    expect(scoreRoleFit(flexPick, 'TOP').score).toBe(LANE_SWAP_SCORE.MIDDLE.TOP)
  })

  it('knows which fits count as on-role', () => {
    expect(isOnRole(scoreRoleFit(malphite, 'SUPPORT'))).toBe(true)
    expect(isOnRole(scoreRoleFit(ahri, 'TOP'))).toBe(false)
  })
})

describe('LANE_SWAP_SCORE', () => {
  const offDiagonal = ROLES.flatMap((from) => ROLES.filter((to) => to !== from).map((to): [Role, Role] => [from, to]))

  it('keeps every lane swap below a secondary role', () => {
    for (const [from, to] of offDiagonal) expect(LANE_SWAP_SCORE[from][to]).toBeLessThan(ROLE_FIT_SCORE.secondaryRole)
  })

  it('makes jungle the hardest role to fake for supports and ADCs', () => {
    expect(LANE_SWAP_SCORE.SUPPORT.JUNGLE).toBeLessThan(ROLE_FIT_BANDS.stretch)
    expect(LANE_SWAP_SCORE.BOTTOM.JUNGLE).toBeLessThan(ROLE_FIT_BANDS.stretch)
  })
})
