import { describe, expect, it } from 'vitest'
import { makeChampion, makeItem } from '../testUtils'
import { CHAMPION_SCORE_WEIGHTS, ROLE_FIT_SCORE, TEAM_SCORE_WEIGHTS } from './config'
import { gradeFor, rateChampion, rateTeam } from './rateTeam'
import type { TeamMember } from './teamBalance'

const rabadon = makeItem({ id: 'Rabadon', stats: { abilityPower: 130 } })
const ie = makeItem({ id: 'IE', stats: { attackDamage: 75, critChance: 25 } })
const thornmail = makeItem({ id: 'Thornmail', stats: { armor: 75, health: 150 } })

const lux = makeChampion({ id: 'Lux', classes: ['Mage'], positions: ['MIDDLE'], damageType: 'AP' })
const jinx = makeChampion({ id: 'Jinx', classes: ['Marksman'], positions: ['BOTTOM'], damageType: 'AD' })
const leona = makeChampion({ id: 'Leona', classes: ['Tank', 'Support'], positions: ['SUPPORT'], damageType: 'AD' })
const garen = makeChampion({ id: 'Garen', classes: ['Fighter', 'Tank'], positions: ['TOP'], damageType: 'AD' })
const zed = makeChampion({ id: 'Zed', classes: ['Assassin'], positions: ['MIDDLE'], damageType: 'AD' })

describe('rateChampion', () => {
  it('weights role fit and item fit into the champion score', () => {
    const rating = rateChampion({ role: 'MIDDLE', champion: lux, items: [rabadon, ie] })
    expect(rating.roleFit.score).toBe(ROLE_FIT_SCORE.onRole)
    const fits = rating.items.map(({ fit }) => fit)
    expect(fits).toHaveLength(2)
    expect(rating.itemFit).toBe(Math.round(fits.reduce((sum, fit) => sum + fit, 0) / fits.length))
    expect(rating.score).toBe(
      Math.round(rating.roleFit.score * CHAMPION_SCORE_WEIGHTS.roleFit + rating.itemFit * CHAMPION_SCORE_WEIGHTS.itemFit),
    )
  })

  it('gives a perfect score to an on-role champion with perfect items', () => {
    expect(rateChampion({ role: 'MIDDLE', champion: lux, items: [rabadon, rabadon] }).score).toBe(100)
  })

  it('collects role and item feedback lines', () => {
    const { feedback } = rateChampion({ role: 'BOTTOM', champion: leona, items: [ie, thornmail] })
    expect(feedback).toEqual([
      'A tank as ADC. Bold strategy to never kill anything.',
      'IE on Leona? Crit on a tank, sure.',
      'Thornmail on Leona: great fit.',
    ])
  })
})

describe('gradeFor', () => {
  it.each([
    [100, 'S'],
    [90, 'S'],
    [85, 'A'],
    [70, 'B'],
    [55, 'C'],
    [40, 'D'],
    [0, 'F'],
  ])('gives %i a grade of %s', (score, grade) => {
    expect(gradeFor(score).grade).toBe(grade)
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

  it('combines champion scores and team balance', () => {
    const rating = rateTeam(dreamTeam)
    const average = rating.champions.reduce((sum, c) => sum + c.score, 0) / rating.champions.length
    expect(rating.score).toBe(
      Math.round(average * TEAM_SCORE_WEIGHTS.champions + rating.balance.score * TEAM_SCORE_WEIGHTS.balance),
    )
    expect(rating.grade).toBe(gradeFor(rating.score).grade)
  })

  it('rates an on-role, well-itemised, balanced team highly', () => {
    expect(rateTeam(dreamTeam).score).toBeGreaterThanOrEqual(80)
  })

  it('rates a chaotic off-role team poorly', () => {
    const chaos: TeamMember[] = [
      { role: 'TOP', champion: jinx, items: [rabadon, thornmail] },
      { role: 'JUNGLE', champion: leona, items: [ie, rabadon] },
      { role: 'MIDDLE', champion: garen, items: [rabadon, rabadon] },
      { role: 'BOTTOM', champion: lux, items: [thornmail, ie] },
      { role: 'SUPPORT', champion: zed, items: [thornmail, thornmail] },
    ]
    expect(rateTeam(chaos).score).toBeLessThan(40)
  })
})
