import { describe, expect, it } from 'vitest'
import { makeChampion, makeItem } from '../testUtils'
import { itemFitLine, roleFitLine } from './feedback'

describe('roleFitLine', () => {
  const janna = makeChampion({ id: 'Janna', classes: ['Support', 'Mage'] })

  it('approves on-role picks', () => {
    expect(roleFitLine(janna, 'SUPPORT', 'onRole')).toBe('Janna in Support. Textbook.')
  })

  it('is lenient when the class fits', () => {
    expect(roleFitLine(janna, 'MIDDLE', 'classFit')).toBe("Janna isn't a usual Mid, but it can work.")
  })

  it('has special lines for famous off-role disasters', () => {
    expect(roleFitLine(janna, 'TOP', 'offRole')).toBe('Support in top lane, brave choice.')
  })

  it('falls back to a generic off-role line', () => {
    const zed = makeChampion({ id: 'Zed', classes: ['Assassin'] })
    expect(roleFitLine(zed, 'BOTTOM', 'offRole')).toBe('Zed ADC? Bold. Very bold.')
  })
})

describe('itemFitLine', () => {
  const leona = makeChampion({ id: 'Leona', classes: ['Tank', 'Support'], damageType: 'AD' })
  const garen = makeChampion({ id: 'Garen', classes: ['Fighter'], damageType: 'AD' })
  const lux = makeChampion({ id: 'Lux', classes: ['Mage'], damageType: 'AP' })
  const jinx = makeChampion({ id: 'Jinx', classes: ['Marksman'], damageType: 'AD' })

  it('compliments good fits', () => {
    expect(itemFitLine(lux, makeItem({ id: 'Rabadon' }), 100)).toBe('Rabadon on Lux: great fit.')
  })

  it('stays quiet for average fits', () => {
    expect(itemFitLine(lux, makeItem(), 50)).toBeNull()
  })

  it('roasts crit on a tank', () => {
    const ie = makeItem({ id: 'IE', stats: { attackDamage: 75, critChance: 25 } })
    expect(itemFitLine(leona, ie, 20)).toBe('IE on Leona? Crit on a tank, sure.')
  })

  it('roasts AP items on AD champions and the other way round', () => {
    expect(itemFitLine(garen, makeItem({ id: 'Rabadon', stats: { abilityPower: 130 } }), 10)).toContain(
      'nowhere to put it',
    )
    expect(itemFitLine(lux, makeItem({ id: 'Sword', stats: { attackDamage: 60 } }), 10)).toContain(
      "Auto attacks won't save you",
    )
  })

  it('roasts tank items on carries', () => {
    expect(itemFitLine(jinx, makeItem({ id: 'Thornmail', stats: { armor: 75 } }), 10)).toBe(
      'Thornmail on Jinx: very safe, very harmless.',
    )
  })

  it('roasts support items on non-supports', () => {
    expect(itemFitLine(garen, makeItem({ id: 'Redemption', stats: { healAndShieldPower: 10 } }), 5)).toContain(
      'Healing allies is nice',
    )
  })
})
