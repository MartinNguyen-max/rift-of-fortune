import { describe, expect, it } from 'vitest'
import { makeChampion, makeItem } from '../testUtils'
import { gameData } from '../../data'
import { ITEM_BUILD_FIT, NEUTRAL_ITEM_FIT } from './config'
import { getItemTags, scoreItemFit, tagAffinity } from './itemFit'

const infinityEdge = makeItem({ id: 'IE', stats: { attackDamage: 75, critChance: 25 } })
const rabadon = makeItem({ id: 'Rabadon', stats: { abilityPower: 130 } })
const zhonya = makeItem({ id: 'Zhonya', stats: { abilityPower: 105, armor: 50 } })
const thornmail = makeItem({ id: 'Thornmail', stats: { health: 150, armor: 75 } })
const redemption = makeItem({ id: 'Redemption', stats: { health: 200, healAndShieldPower: 10, manaRegen: 100 } })
const youmuu = makeItem({ id: 'Youmuu', stats: { attackDamage: 55, lethality: 18 } })

const jinx = makeChampion({ classes: ['Marksman'], damageType: 'AD' })
const lux = makeChampion({ classes: ['Mage', 'Support'], damageType: 'AP' })
const leona = makeChampion({ classes: ['Tank', 'Support'], damageType: 'AD' })
const garen = makeChampion({ classes: ['Fighter', 'Tank'], damageType: 'AD' })
const zed = makeChampion({ classes: ['Assassin'], damageType: 'AD' })

describe('getItemTags', () => {
  it('tags damage, crit, attack speed and lethality stats', () => {
    expect(getItemTags(infinityEdge)).toEqual(['AD', 'CRIT'])
    expect(getItemTags(youmuu)).toEqual(['AD', 'LETHALITY'])
    expect(getItemTags(makeItem({ stats: { attackSpeed: 40 } }))).toEqual(['ATTACK_SPEED'])
  })

  it('tags AP from ability power or magic penetration', () => {
    expect(getItemTags(rabadon)).toEqual(['AP'])
    expect(getItemTags(makeItem({ stats: { magicPenetration: 40 } }))).toEqual(['AP'])
  })

  it('only tags defensive stats as TANK when the item has no offensive stats', () => {
    expect(getItemTags(thornmail)).toEqual(['TANK'])
    expect(getItemTags(zhonya)).toEqual(['AP'])
  })

  it('tags heal and shield power or mana regen as ENCHANTER', () => {
    expect(getItemTags(redemption)).toEqual(['ENCHANTER', 'TANK'])
  })

  it('returns no tags for an item without known stats', () => {
    expect(getItemTags(makeItem({ stats: { moveSpeed: 5 } }))).toEqual([])
  })
})

describe('tagAffinity', () => {
  it('rewards damage items of the champion’s own damage type', () => {
    expect(tagAffinity(lux, 'AP')).toBeGreaterThan(tagAffinity(lux, 'AD'))
    expect(tagAffinity(jinx, 'AD')).toBeGreaterThan(tagAffinity(jinx, 'AP'))
  })

  it('uses the best-matching class of a multi-class champion', () => {
    expect(tagAffinity(lux, 'ENCHANTER')).toBe(100)
    expect(tagAffinity(garen, 'TANK')).toBe(100)
  })
})

describe('scoreItemFit', () => {
  it('loves AP items on mages', () => {
    expect(scoreItemFit(lux, rabadon)).toBe(100)
  })

  it('hates crit items on a support tank', () => {
    expect(scoreItemFit(leona, infinityEdge)).toBeLessThan(30)
    expect(scoreItemFit(jinx, infinityEdge)).toBeGreaterThan(90)
  })

  it('hates AP items on AD champions', () => {
    expect(scoreItemFit(garen, rabadon)).toBeLessThan(30)
  })

  it('likes tank items on tanks and fighters but not on marksmen', () => {
    expect(scoreItemFit(leona, thornmail)).toBe(100)
    expect(scoreItemFit(garen, thornmail)).toBe(100)
    expect(scoreItemFit(jinx, thornmail)).toBeLessThan(30)
  })

  it('likes lethality on assassins more than on marksmen', () => {
    expect(scoreItemFit(zed, youmuu)).toBe(100)
    expect(scoreItemFit(jinx, youmuu)).toBeLessThan(scoreItemFit(zed, youmuu))
  })

  it('averages over the item’s tags', () => {
    expect(scoreItemFit(lux, redemption)).toBe(Math.round((tagAffinity(lux, 'ENCHANTER') + tagAffinity(lux, 'TANK')) / 2))
  })

  it('gives a neutral score to items without known stats', () => {
    expect(scoreItemFit(jinx, makeItem({ stats: {} }))).toBe(NEUTRAL_ITEM_FIT)
  })
})

describe('scoreItemFit with the build table', () => {
  const item = (name: string) => {
    const found = gameData.items.find((entry) => entry.name === name)
    if (!found) throw new Error(`No item ${name}`)
    return found
  }
  const champion = (id: string) => {
    const found = gameData.champions.find((entry) => entry.id === id)
    if (!found) throw new Error(`No champion ${id}`)
    return found
  }

  it('gives a perfect fit to items the champion really builds', () => {
    expect(scoreItemFit(champion('Jinx'), item('Infinity Edge'))).toBe(ITEM_BUILD_FIT.main)
    expect(scoreItemFit(champion('Darius'), item('Sterak\'s Gage'))).toBe(ITEM_BUILD_FIT.main)
    expect(scoreItemFit(champion('Lux'), item('Luden\'s Echo'))).toBe(ITEM_BUILD_FIT.main)
    expect(scoreItemFit(champion('Janna'), item('Moonstone Renewer'))).toBe(ITEM_BUILD_FIT.main)
  })

  it('gives a slightly lower fit to items of the champion\'s second profile', () => {
    expect(scoreItemFit(champion('Ashe'), item('Guinsoo\'s Rageblade'))).toBe(ITEM_BUILD_FIT.second)
  })

  it('punishes items the champion would never build, even with the right damage type', () => {
    expect(scoreItemFit(champion('Jinx'), item('Sterak\'s Gage'))).toBeLessThanOrEqual(ITEM_BUILD_FIT.offBuildCap)
    expect(scoreItemFit(champion('Zed'), item('Infinity Edge'))).toBeLessThanOrEqual(ITEM_BUILD_FIT.offBuildCap)
    expect(scoreItemFit(champion('Lux'), item('Nashor\'s Tooth'))).toBeLessThanOrEqual(ITEM_BUILD_FIT.offBuildCap)
  })

  it('punishes the wrong damage type the most', () => {
    expect(scoreItemFit(champion('Jinx'), item('Rabadon\'s Deathcap'))).toBeLessThanOrEqual(15)
    expect(scoreItemFit(champion('Lux'), item('Infinity Edge'))).toBeLessThanOrEqual(15)
  })
})
