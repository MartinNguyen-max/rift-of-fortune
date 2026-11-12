import { describe, expect, it } from 'vitest'
import type { Champion } from '../../data/types'
import { makeChampion, makeItem } from '../testUtils'
import { CHAMPION_SCORE_WEIGHTS, ROLE_FIT_SCORE, WORST_ITEM_WEIGHT } from './config'
import { LINES, verdictLine } from './feedback'
import { rankFor } from './rank'
import { combineItemFits, rateChampion, rateTeam } from './rateTeam'
import type { TeamMember } from './teamBalance'

const rabadon = makeItem({ id: 'Rabadon', stats: { abilityPower: 130 } })
const ie = makeItem({ id: 'IE', stats: { attackDamage: 75, critChance: 25 } })
const thornmail = makeItem({ id: 'Thornmail', stats: { armor: 75, health: 150 } })

const lux = makeChampion({ id: 'Lux', classes: ['Mage'], positions: ['MIDDLE'], damageType: 'AP', attackType: 'RANGED' })
const jinx = makeChampion({
  id: 'Jinx',
  classes: ['Marksman'],
  positions: ['BOTTOM'],
  damageType: 'AD',
  attackType: 'RANGED',
})
const leona = makeChampion({ id: 'Leona', classes: ['Tank', 'Support'], positions: ['SUPPORT'], damageType: 'AD' })
const garen = makeChampion({ id: 'Garen', classes: ['Fighter', 'Tank'], positions: ['TOP'], damageType: 'AD' })
const zed = makeChampion({ id: 'Zed', classes: ['Assassin'], positions: ['MIDDLE'], damageType: 'AD' })

describe('rateChampion', () => {
  it('weights role fit and item fit into the champion score', () => {
    const rating = rateChampion({ role: 'MIDDLE', champion: lux, items: [rabadon, ie] })
    expect(rating.roleFit.score).toBe(ROLE_FIT_SCORE.mainRole)
    const fits = rating.items.map(({ fit }) => fit)
    expect(fits).toHaveLength(2)
    expect(rating.itemFit).toBe(combineItemFits(fits))
    expect(rating.score).toBe(
      Math.round(rating.roleFit.score * CHAMPION_SCORE_WEIGHTS.roleFit + rating.itemFit * CHAMPION_SCORE_WEIGHTS.itemFit),
    )
  })

  it('gives a perfect score to an on-role champion with perfect items', () => {
    expect(rateChampion({ role: 'MIDDLE', champion: lux, items: [rabadon, rabadon] }).score).toBe(100)
  })

  it('adds a verdict based on the champion score', () => {
    const rating = rateChampion({ role: 'MIDDLE', champion: lux, items: [rabadon, rabadon] })
    expect(rating.verdict).toBe(verdictLine('Lux', 100))
  })

  it('collects role and item feedback lines', () => {
    const { feedback } = rateChampion({ role: 'BOTTOM', champion: leona, items: [ie, thornmail] })
    expect(feedback).toHaveLength(3)
    expect(feedback[0]).toBe('A tank as ADC. Bold strategy to never kill anything.')
    expect(feedback[1]).toBeOneOf(LINES.critOnTank('IE on Leona', 'tank'))
    expect(feedback[2]).toBeOneOf(LINES.goodItem('Thornmail on Leona'))
  })
})

describe('rateTeam', () => {
  const dreamTeam: TeamMember[] = [
    { role: 'TOP', champion: garen, items: [thornmail, thornmail] },
    { role: 'JUNGLE', champion: { ...zed, positions: ['JUNGLE'] }, items: [ie, ie] },
    { role: 'MIDDLE', champion: lux, items: [rabadon, rabadon] },
    { role: 'BOTTOM', champion: jinx, items: [ie, ie] },
    { role: 'SUPPORT', champion: leona, items: [thornmail, thornmail] },
  ]

  it('takes the balance penalty off the average champion score', () => {
    const rating = rateTeam(dreamTeam)
    const average = rating.champions.reduce((sum, c) => sum + c.score, 0) / rating.champions.length
    expect(rating.championAverage).toBe(Math.round(average))
    expect(rating.score).toBe(rating.championAverage - rating.balance.penalty)
    expect(rating.rank).toEqual(rankFor(rating.score))
  })

  it('never goes below zero', () => {
    const hopeless: TeamMember[] = dreamTeam.map((member) => ({ ...member, champion: zed, items: [thornmail, thornmail] }))
    expect(rateTeam(hopeless).score).toBeGreaterThanOrEqual(0)
  })

  it('rates an on-role, well-itemised, balanced team Diamond or higher', () => {
    expect(['Diamond', 'Master', 'Grandmaster', 'Challenger']).toContain(rateTeam(dreamTeam).rank.tier)
  })

  it('includes coach notes', () => {
    expect(rateTeam(dreamTeam).coachNotes.length).toBeGreaterThan(0)
  })

  it('rates a chaotic off-role team poorly', () => {
    const chaos: TeamMember[] = [
      { role: 'TOP', champion: jinx, items: [rabadon, thornmail] },
      { role: 'JUNGLE', champion: leona, items: [ie, rabadon] },
      { role: 'MIDDLE', champion: garen, items: [rabadon, rabadon] },
      { role: 'BOTTOM', champion: lux, items: [thornmail, ie] },
      { role: 'SUPPORT', champion: zed, items: [thornmail, thornmail] },
    ]
    expect(rateTeam(chaos).score).toBeLessThan(30)
  })

  it('rates four off-role junglers and a Malphite Iron, even with good items (playtest team)', () => {
    // The team from playtesting that used to get Platinum.
    const bloodthirster = makeItem({ id: 'Bloodthirster', stats: { attackDamage: 80, lifeSteal: 15 } })
    const champion = (id: string, classes: Champion['classes'], damageType: Champion['damageType'] = 'AD') =>
      makeChampion({ id, classes, positions: ['JUNGLE'], damageType })
    const team: TeamMember[] = [
      { role: 'TOP', champion: champion('Belveth', ['Fighter']), items: [bloodthirster, bloodthirster] },
      { role: 'JUNGLE', champion: { ...champion('Malphite', ['Tank', 'Mage'], 'AP'), positions: ['TOP'] }, items: [thornmail, thornmail] },
      { role: 'MIDDLE', champion: champion('Vi', ['Fighter', 'Assassin']), items: [bloodthirster, bloodthirster] },
      { role: 'BOTTOM', champion: champion('LeeSin', ['Fighter', 'Assassin']), items: [bloodthirster, bloodthirster] },
      { role: 'SUPPORT', champion: champion('Rammus', ['Tank']), items: [thornmail, thornmail] },
    ]
    expect(rateTeam(team).rank.tier).toBe('Iron')
  })
})

describe('combineItemFits', () => {
  it('leans toward the worst item, so one troll item hurts', () => {
    expect(combineItemFits([100, 100])).toBe(100)
    expect(combineItemFits([100, 10])).toBe(Math.round(10 * WORST_ITEM_WEIGHT + 100 * (1 - WORST_ITEM_WEIGHT)))
    expect(combineItemFits([100, 10])).toBeLessThan(55)
    expect(combineItemFits([])).toBe(0)
  })
})
