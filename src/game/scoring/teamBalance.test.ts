import { describe, expect, it } from 'vitest'
import type { Champion, Item, Role } from '../../data/types'
import { makeChampion, makeItem } from '../testUtils'
import { BALANCE_PENALTIES } from './config'
import {
  checkCarries,
  checkDamageItems,
  checkDamageMix,
  checkFrontline,
  isFrontline,
  scoreTeamBalance,
  type TeamMember,
} from './teamBalance'

const sword = makeItem({ id: 'Sword', stats: { attackDamage: 60 } })
const staff = makeItem({ id: 'Staff', stats: { abilityPower: 100 } })
const armor = makeItem({ id: 'Armor', stats: { armor: 60, health: 300 } })

const member = (champion: Partial<Champion>, items: Item[] = [sword, sword], role: Role = 'TOP'): TeamMember => ({
  role,
  champion: makeChampion(champion),
  items,
})

const tank = member({ id: 'Tank', classes: ['Tank'], damageType: 'AP' }, [armor, armor])
const marksman = member({ id: 'Marksman', classes: ['Marksman'], damageType: 'AD' })
const mage = member({ id: 'Mage', classes: ['Mage'], damageType: 'AP' }, [staff, staff])
const fighter = member({ id: 'Fighter', classes: ['Fighter'], damageType: 'AD' })

describe('checkDamageMix', () => {
  it('penalises a full AD team', () => {
    const result = checkDamageMix([marksman, fighter, marksman, fighter, marksman])
    expect(result).toMatchObject({ passed: false, penalty: BALANCE_PENALTIES.oneDamageType })
    expect(result.message).toContain('Full AD')
  })

  it('penalises a full AP team', () => {
    expect(checkDamageMix([mage, tank, mage, tank, mage]).message).toContain('Full AP')
  })

  it('passes with a mix of AD and AP', () => {
    expect(checkDamageMix([marksman, mage, tank, fighter, marksman])).toMatchObject({ passed: true, penalty: 0 })
  })
})

describe('checkFrontline', () => {
  it('counts tanks as frontline', () => {
    expect(isFrontline(tank)).toBe(true)
  })

  it('counts fighters as frontline only with a tank item', () => {
    expect(isFrontline(fighter)).toBe(false)
    expect(isFrontline({ ...fighter, items: [sword, armor] })).toBe(true)
  })

  it('penalises a team without frontline', () => {
    const result = checkFrontline([marksman, mage, fighter, marksman, mage])
    expect(result).toMatchObject({ passed: false, penalty: BALANCE_PENALTIES.noFrontline })
    expect(result.message).toBe("No frontline. Who's walking in first?")
  })

  it('names the frontline when there is one', () => {
    expect(checkFrontline([tank, marksman]).message).toContain('Tank')
  })
})

describe('checkCarries', () => {
  it('penalises a team without marksman, mage or assassin', () => {
    expect(checkCarries([tank, fighter, tank, fighter, tank])).toMatchObject({
      passed: false,
      penalty: BALANCE_PENALTIES.noCarry,
    })
  })

  it('passes with at least one carry', () => {
    expect(checkCarries([tank, fighter, mage]).passed).toBe(true)
  })
})

describe('checkDamageItems', () => {
  it('penalises a team with fewer than three damage items', () => {
    const result = checkDamageItems([tank, tank, tank, member({}, [sword, armor])])
    expect(result).toMatchObject({ passed: false, penalty: BALANCE_PENALTIES.fewDamageItems })
    expect(result.message).toContain('Only 1 damage item.')
  })

  it('passes with three or more damage items', () => {
    expect(checkDamageItems([marksman, member({}, [staff, armor])]).passed).toBe(true)
  })
})

describe('scoreTeamBalance', () => {
  it('scores 100 for a well-rounded team', () => {
    expect(scoreTeamBalance([tank, fighter, mage, marksman, tank]).score).toBe(100)
  })

  it('subtracts every failed check, never going below zero', () => {
    const allFighters = [fighter, fighter, fighter, fighter, fighter]
    const { score, checks } = scoreTeamBalance(allFighters)
    const expected = 100 - BALANCE_PENALTIES.oneDamageType - BALANCE_PENALTIES.noFrontline - BALANCE_PENALTIES.noCarry
    expect(score).toBe(Math.max(0, expected))
    expect(checks.filter((c) => !c.passed).map((c) => c.id)).toEqual(['oneDamageType', 'noFrontline', 'noCarry'])
  })
})
