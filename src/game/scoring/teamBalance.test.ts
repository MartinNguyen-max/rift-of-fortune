import { describe, expect, it } from 'vitest'
import type { Champion, Item, Role } from '../../data/types'
import { makeChampion, makeItem } from '../testUtils'
import { BALANCE_PENALTIES, MAX_BALANCE_PENALTY } from './config'
import { BALANCE_LINES } from './feedback'
import {
  checkBotLane,
  checkCarries,
  checkDamageItems,
  checkDamageMix,
  checkFrontline,
  checkRange,
  isCarry,
  isFrontline,
  joinNames,
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

const tank = member({ id: 'Tank', classes: ['Tank'], damageType: 'AP' }, [armor, armor], 'SUPPORT')
const marksman = member({ id: 'Marksman', classes: ['Marksman'], attackType: 'RANGED' }, [sword, sword], 'BOTTOM')
const mage = member({ id: 'Mage', classes: ['Mage'], damageType: 'AP', attackType: 'RANGED' }, [staff, staff], 'MIDDLE')
const fighter = member({ id: 'Fighter', classes: ['Fighter'] })
const bruiserAssassin = member({ id: 'Vi', classes: ['Fighter', 'Assassin'] }, [sword, sword], 'JUNGLE')

describe('checkDamageMix', () => {
  it('penalises a full AD team', () => {
    const result = checkDamageMix([marksman, fighter, marksman, fighter, marksman])
    expect(result).toMatchObject({ passed: false, penalty: BALANCE_PENALTIES.oneDamageType })
    expect(result.message).toBeOneOf(BALANCE_LINES.fullAd())
  })

  it('penalises a full AP team', () => {
    expect(checkDamageMix([mage, tank, mage, tank, mage]).message).toBeOneOf(BALANCE_LINES.fullAp())
  })

  it('penalises a lopsided 4–1 team a little, naming the lone champion', () => {
    const result = checkDamageMix([marksman, fighter, fighter, bruiserAssassin, tank])
    expect(result).toMatchObject({ passed: false, penalty: BALANCE_PENALTIES.lopsidedDamage })
    expect(result.message).toBeOneOf(BALANCE_LINES.lopsidedDamage('AD', 4, 'Tank'))
  })

  it('passes with a 3–2 mix', () => {
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
    expect(result.message).toBeOneOf(BALANCE_LINES.noFrontline())
  })

  it('penalises a team that is almost all frontline', () => {
    const result = checkFrontline([tank, tank, tank, tank, marksman])
    expect(result).toMatchObject({ passed: false, penalty: BALANCE_PENALTIES.tooManyFrontline })
    expect(result.message).toBeOneOf(BALANCE_LINES.tooManyFrontline(4))
  })

  it('names the frontline when it is healthy', () => {
    expect(checkFrontline([tank, marksman]).message).toBeOneOf(BALANCE_LINES.frontline('Tank'))
  })
})

describe('checkCarries', () => {
  it('only counts the main class, so a Fighter/Assassin is not a carry', () => {
    expect(isCarry(bruiserAssassin)).toBe(false)
    expect(isCarry(member({ classes: ['Assassin', 'Fighter'] }))).toBe(true)
  })

  it('penalises a team without a real carry', () => {
    expect(checkCarries([tank, fighter, bruiserAssassin, fighter, tank])).toMatchObject({
      passed: false,
      penalty: BALANCE_PENALTIES.noCarry,
    })
  })

  it('passes with at least one carry', () => {
    expect(checkCarries([tank, fighter, mage]).passed).toBe(true)
  })
})

describe('checkBotLane', () => {
  it('passes with a marksman in the ADC slot', () => {
    expect(checkBotLane([marksman, tank]).passed).toBe(true)
  })

  it('penalises anyone else in the ADC slot', () => {
    const leeSin = member({ id: 'LeeSin', name: 'Lee Sin', classes: ['Fighter', 'Assassin'] }, [sword, sword], 'BOTTOM')
    const result = checkBotLane([leeSin, tank])
    expect(result).toMatchObject({ passed: false, penalty: BALANCE_PENALTIES.noMarksmanBot })
    expect(result.message).toBeOneOf(BALANCE_LINES.noMarksmanBot('Lee Sin'))
  })
})

describe('checkRange', () => {
  it('penalises a team of five melee champions', () => {
    const result = checkRange([fighter, tank, fighter, tank, bruiserAssassin])
    expect(result).toMatchObject({ passed: false, penalty: BALANCE_PENALTIES.allMelee })
    expect(result.message).toBeOneOf(BALANCE_LINES.allMelee())
  })

  it('passes with at least one ranged champion', () => {
    expect(checkRange([fighter, tank, mage]).message).toBeOneOf(BALANCE_LINES.someRanged(1))
  })
})

describe('checkDamageItems', () => {
  it('penalises a team with fewer than three damage items', () => {
    const result = checkDamageItems([tank, tank, tank, member({}, [sword, armor])])
    expect(result).toMatchObject({ passed: false, penalty: BALANCE_PENALTIES.fewDamageItems })
    expect(result.message).toBeOneOf(BALANCE_LINES.fewDamageItems(1))
  })

  it('passes with three or more damage items', () => {
    expect(checkDamageItems([marksman, member({}, [staff, armor])]).passed).toBe(true)
  })
})

describe('scoreTeamBalance', () => {
  it('has no penalty for a well-rounded team', () => {
    expect(scoreTeamBalance([tank, fighter, mage, marksman, bruiserAssassin]).penalty).toBe(0)
  })

  it('adds up the failed checks', () => {
    const team = [fighter, fighter, fighter, member({ classes: ['Fighter'] }, [sword, sword], 'BOTTOM'), tank]
    const { penalty, checks } = scoreTeamBalance(team)
    expect(checks.filter((c) => !c.passed).map((c) => c.id)).toEqual(['damageMix', 'carry', 'botLane', 'range'])
    expect(penalty).toBe(
      BALANCE_PENALTIES.lopsidedDamage +
        BALANCE_PENALTIES.noCarry +
        BALANCE_PENALTIES.noMarksmanBot +
        BALANCE_PENALTIES.allMelee,
    )
  })

  it(`never takes off more than ${MAX_BALANCE_PENALTY} points`, () => {
    const allFighters = [fighter, fighter, fighter, member({ classes: ['Fighter'] }, [], 'BOTTOM'), fighter]
    expect(scoreTeamBalance(allFighters).penalty).toBe(MAX_BALANCE_PENALTY)
  })
})

describe('joinNames', () => {
  it('lists names naturally', () => {
    expect(joinNames([tank])).toBe('Tank')
    expect(joinNames([tank, mage])).toBe('Tank and Mage')
    expect(joinNames([tank, mage, fighter])).toBe('Tank, Mage and Fighter')
  })
})
