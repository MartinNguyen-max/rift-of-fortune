import { describe, expect, it } from 'vitest'
import { makeChampion } from '../testUtils'
import { ROLE_FIT_SCORE } from './config'
import { scoreRoleFit } from './roleFit'

describe('scoreRoleFit', () => {
  it('scores high when the champion normally plays the role', () => {
    const ahri = makeChampion({ classes: ['Mage'], positions: ['MIDDLE'] })
    expect(scoreRoleFit(ahri, 'MIDDLE')).toEqual({ kind: 'onRole', score: ROLE_FIT_SCORE.onRole })
  })

  it('gives partial credit when the class suits the role', () => {
    const malphite = makeChampion({ classes: ['Tank'], positions: ['TOP'] })
    expect(scoreRoleFit(malphite, 'SUPPORT')).toEqual({ kind: 'classFit', score: ROLE_FIT_SCORE.classFit })
  })

  it('scores low when neither positions nor class fit', () => {
    const janna = makeChampion({ classes: ['Support', 'Mage'], positions: ['SUPPORT'] })
    expect(scoreRoleFit(janna, 'TOP')).toEqual({ kind: 'offRole', score: ROLE_FIT_SCORE.offRole })
  })

  it('ranks on-role above class fit above off-role', () => {
    expect(ROLE_FIT_SCORE.onRole).toBeGreaterThan(ROLE_FIT_SCORE.classFit)
    expect(ROLE_FIT_SCORE.classFit).toBeGreaterThan(ROLE_FIT_SCORE.offRole)
  })
})
