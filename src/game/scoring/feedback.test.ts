import { describe, expect, it } from 'vitest'
import { makeChampion, makeItem } from '../testUtils'
import { itemFitLine, LINES, pickLine, roleFitLine, VERDICT_LINES, verdictLine } from './feedback'

describe('pickLine', () => {
  const lines = ['a', 'b', 'c']

  it('always picks the same line for the same seed', () => {
    expect(pickLine(lines, 'Ahri:MIDDLE')).toBe(pickLine(lines, 'Ahri:MIDDLE'))
  })

  it('spreads different seeds over different lines', () => {
    const picked = new Set(['Ahri', 'Garen', 'Jinx', 'Leona', 'Lux', 'Zed', 'Teemo'].map((seed) => pickLine(lines, seed)))
    expect(picked.size).toBeGreaterThan(1)
  })

  it('throws when there is nothing to pick', () => {
    expect(() => pickLine([], 'x')).toThrow()
  })
})

describe('roleFitLine', () => {
  const janna = makeChampion({ id: 'Janna', classes: ['Support', 'Mage'] })

  it('approves on-role picks', () => {
    expect(roleFitLine(janna, 'SUPPORT', 'onRole')).toBeOneOf(LINES.onRole('Janna', 'Support'))
  })

  it('is lenient when the class fits', () => {
    expect(roleFitLine(janna, 'MIDDLE', 'classFit')).toBeOneOf(LINES.classFit('Janna', 'Mid'))
  })

  it('has special lines for famous off-role disasters', () => {
    expect(roleFitLine(janna, 'TOP', 'offRole')).toBe('Support in top lane, brave choice.')
  })

  it('falls back to a generic off-role line', () => {
    const zed = makeChampion({ id: 'Zed', classes: ['Assassin'] })
    expect(roleFitLine(zed, 'BOTTOM', 'offRole')).toBeOneOf(LINES.offRole('Zed', 'ADC'))
  })
})

describe('itemFitLine', () => {
  const leona = makeChampion({ id: 'Leona', classes: ['Tank', 'Support'], damageType: 'AD' })
  const garen = makeChampion({ id: 'Garen', classes: ['Fighter'], damageType: 'AD' })
  const lux = makeChampion({ id: 'Lux', classes: ['Mage'], damageType: 'AP' })
  const jinx = makeChampion({ id: 'Jinx', classes: ['Marksman'], damageType: 'AD' })

  it('compliments good fits', () => {
    expect(itemFitLine(lux, makeItem({ id: 'Rabadon' }), 100)).toBeOneOf(LINES.goodItem('Rabadon on Lux'))
  })

  it('stays quiet for average fits', () => {
    expect(itemFitLine(lux, makeItem(), 50)).toBeNull()
  })

  it('roasts crit on a tank', () => {
    const ie = makeItem({ id: 'IE', stats: { attackDamage: 75, critChance: 25 } })
    expect(itemFitLine(leona, ie, 20)).toBeOneOf(LINES.critOnTank('IE on Leona', 'tank'))
  })

  it('roasts AP items on AD champions and the other way round', () => {
    const rabadon = makeItem({ id: 'Rabadon', stats: { abilityPower: 130 } })
    const sword = makeItem({ id: 'Sword', stats: { attackDamage: 60 } })
    expect(itemFitLine(garen, rabadon, 10)).toBeOneOf(LINES.apOnAd('Rabadon on Garen'))
    expect(itemFitLine(lux, sword, 10)).toBeOneOf(LINES.adOnAp('Sword on Lux'))
  })

  it('roasts tank items on carries', () => {
    const thornmail = makeItem({ id: 'Thornmail', stats: { armor: 75 } })
    expect(itemFitLine(jinx, thornmail, 10)).toBeOneOf(LINES.tankOnCarry('Thornmail on Jinx'))
  })

  it('roasts support items on non-supports', () => {
    const redemption = makeItem({ id: 'Redemption', stats: { healAndShieldPower: 10 } })
    expect(itemFitLine(garen, redemption, 5)).toBeOneOf(LINES.enchanterOnCarry('Redemption on Garen'))
  })

  it('has a fallback for bad items without a special joke', () => {
    expect(itemFitLine(jinx, makeItem({ id: 'Boots' }), 5)).toBeOneOf(LINES.uselessItem('Boots on Jinx'))
  })
})

describe('verdictLine', () => {
  it('praises high scores and roasts low ones', () => {
    expect(verdictLine('Ahri', 95)).toBeOneOf(VERDICT_LINES[0].lines)
    expect(verdictLine('Ahri', 5)).toBeOneOf(VERDICT_LINES[VERDICT_LINES.length - 1]?.lines ?? [])
  })

  it('always gives the same verdict for the same champion and score', () => {
    expect(verdictLine('Garen', 50)).toBe(verdictLine('Garen', 50))
  })
})
