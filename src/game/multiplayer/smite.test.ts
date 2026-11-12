import { describe, expect, it } from 'vitest'
import { hpAt, SMITE_LEAD_IN, smiteDuel, smiteResult, type SmiteDuel } from './smite'

const duels: SmiteDuel[] = Array.from({ length: 200 }, (_, seed) => smiteDuel(seed % 2 ? 'baron' : 'elder', seed))

describe('smiteDuel', () => {
  it('is the same for both players with the same seed', () => {
    expect(smiteDuel('baron', 7)).toEqual(smiteDuel('baron', 7))
    expect(smiteDuel('baron', 8)).not.toEqual(smiteDuel('baron', 7))
  })

  it('starts at full health and ends dead, always going down', () => {
    for (const duel of duels) {
      expect(hpAt(duel, 0)).toBe(1)
      expect(hpAt(duel, duel.deathAt)).toBe(0)
      duel.hits.forEach((hit, index) => {
        const before = duel.hits[index - 1]
        if (before) {
          expect(hit.hp).toBeLessThan(before.hp)
          expect(hit.at).toBeGreaterThan(before.at)
        }
      })
    }
  })

  it('always leaves a window to smite in: at least one hit stops inside smite range', () => {
    for (const duel of duels) {
      const inRange = duel.hits.filter(({ hp }) => hp > 0 && hp <= duel.threshold)
      expect(inRange.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('lasts a few seconds', () => {
    for (const duel of duels) {
      expect(duel.deathAt).toBeGreaterThan(3)
      expect(duel.deathAt).toBeLessThan(12)
    }
  })
})

describe('smiteResult', () => {
  const duel = smiteDuel('baron', 3)
  const firstInRange = duel.hits.find(({ hp }) => hp <= duel.threshold) ?? { at: 0, hp: 1 }
  const lastAlive = duel.hits.findLast(({ hp }) => hp > 0) ?? { at: 0, hp: 1 }

  it('scores 0 for smiting before the health is in range', () => {
    expect(smiteResult(duel, SMITE_LEAD_IN / 2)).toMatchObject({ outcome: 'early', score: 0 })
  })

  it('scores 0 when the objective is already dead, or for never smiting', () => {
    expect(smiteResult(duel, duel.deathAt)).toMatchObject({ outcome: 'late', score: 0 })
    expect(smiteResult(duel, null)).toMatchObject({ outcome: 'late', score: 0 })
  })

  it('scores higher the lower the health when smiting in range', () => {
    const early = smiteResult(duel, firstInRange.at)
    const late = smiteResult(duel, lastAlive.at)
    expect(early.outcome).toBe('hit')
    expect(early.score).toBeGreaterThanOrEqual(50)
    expect(late.score).toBeGreaterThan(early.score)
    expect(late.score).toBeLessThanOrEqual(100)
  })

  it('reports the health the smite landed on in shown health points', () => {
    expect(smiteResult(duel, firstInRange.at).hp).toBeLessThanOrEqual(1200)
  })
})
