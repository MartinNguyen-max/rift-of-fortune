import { describe, expect, it } from 'vitest'
import {
  botSmite,
  duelOfStep,
  hpAt,
  LONGEST_SMITE_DUEL,
  NO_SMITE,
  SMITE_LEAD_IN,
  SMITE_RULES,
  smiteDuel,
  smiteResult,
  smiteTargets,
  type SmiteDuel,
} from './smite'
import { soloSetup, type GameSetup } from './versus'

const duels: SmiteDuel[] = Array.from({ length: 200 }, (_, seed) => smiteDuel(seed % 2 ? 'baron' : 'elder', seed))

describe('smiteDuel', () => {
  it('is the same for both players with the same seed', () => {
    expect(smiteDuel('baron', 7)).toEqual(smiteDuel('baron', 7))
    expect(smiteDuel('baron', 8)).not.toEqual(smiteDuel('baron', 7))
  })

  it('starts at full health and ends dead, always going down', () => {
    for (const duel of duels) {
      expect(hpAt(duel, 0)).toBe(1)
      expect(hpAt(duel, SMITE_LEAD_IN)).toBe(1)
      expect(hpAt(duel, duel.deathAt)).toBe(0)
      let before = 1
      for (let time = SMITE_LEAD_IN + 0.05; time < duel.deathAt; time += 0.05) {
        const hp = hpAt(duel, time)
        expect(hp).toBeLessThan(before)
        before = hp
      }
    }
  })

  it('drains smoothly: no jumps between two frames', () => {
    for (const duel of duels) {
      for (let time = 0; time < duel.deathAt; time += 1 / 60) {
        expect(hpAt(duel, time) - hpAt(duel, time + 1 / 60)).toBeLessThan(0.03)
      }
    }
  })

  it('changes pace: the fastest stretch in smite range drains at least twice as fast as the slowest', () => {
    for (const duel of duels) {
      const inRange = duel.points.filter(({ at }) => at >= duel.rangeAt)
      const paces = inRange.slice(1).map((point, index) => {
        const before = inRange[index] ?? point
        return (before.hp - point.hp) / (point.at - before.at)
      })
      expect(Math.max(...paces) / Math.min(...paces)).toBeGreaterThan(2)
    }
  })

  it('reaches smite range around the middle of the duel', () => {
    for (const duel of duels) {
      expect(hpAt(duel, duel.rangeAt)).toBeCloseTo(duel.threshold)
      const share = duel.rangeAt / duel.deathAt
      expect(share).toBeGreaterThan(0.35)
      expect(share).toBeLessThan(0.7)
      expect(duel.deathAt - duel.rangeAt).toBeGreaterThan(2.5)
      expect(duel.deathAt).toBeLessThanOrEqual(LONGEST_SMITE_DUEL)
    }
  })
})

describe('smiteResult', () => {
  const duel = smiteDuel('baron', 3)

  it('scores 0 for smiting before the health is in range', () => {
    expect(smiteResult(duel, SMITE_LEAD_IN / 2)).toMatchObject({ outcome: 'early', score: 0 })
    expect(smiteResult(duel, duel.rangeAt - 0.1)).toMatchObject({ outcome: 'early', score: 0 })
  })

  it('scores 0 when the objective is already dead, or for never smiting', () => {
    expect(smiteResult(duel, duel.deathAt)).toMatchObject({ outcome: 'late', score: 0 })
    expect(smiteResult(duel, null)).toMatchObject({ outcome: 'late', score: 0 })
  })

  it('scores 50 entering range, more the lower the health, almost 100 right before it dies', () => {
    const entering = smiteResult(duel, duel.rangeAt + 0.001)
    const middle = smiteResult(duel, (duel.rangeAt + duel.deathAt) / 2)
    const last = smiteResult(duel, duel.deathAt - 0.01)
    expect(entering).toMatchObject({ outcome: 'hit', score: 50 })
    expect(middle.score).toBeGreaterThan(entering.score)
    expect(last.score).toBeGreaterThan(middle.score)
    expect(last.score).toBeGreaterThanOrEqual(98)
  })

  it('reports the health the smite landed on in shown health points', () => {
    expect(smiteResult(duel, duel.rangeAt + 0.5).hp).toBeLessThanOrEqual(1200)
  })
})

describe('SMITE_RULES', () => {
  const solo = soloSetup(9)
  const live: GameSetup = { seed: 9, variant: 'live', bothRoles: false, late: false }

  it('plays Baron then Elder solo, and one target live (Elder when late)', () => {
    expect(smiteTargets(solo)).toEqual(['baron', 'elder'])
    expect(smiteTargets(live)).toEqual(['baron'])
    expect(smiteTargets({ ...live, late: true })).toEqual(['elder'])
  })

  it('adds up the scores of every duel; the higher total wins', () => {
    const at = (step: number, share: number) => {
      const duel = duelOfStep(solo, step)
      if (!duel) throw new Error('No duel')
      return Math.round((duel.rangeAt + (duel.deathAt - duel.rangeAt) * share) * 1000)
    }
    expect(SMITE_RULES.settle([[at(0, 0.9)], [at(0, 0.5)]], solo)).toBeNull()
    const settled = SMITE_RULES.settle([[at(0, 0.9), at(1, 0.9)], [at(0, 0.5), NO_SMITE]], solo)
    expect(settled?.winner).toBe(0)
    expect(settled?.scores[1]).toBeLessThan(100)
  })

  it('owes each player their next duel', () => {
    expect(SMITE_RULES.owed([[1000], []], solo)).toEqual([
      { player: 0, step: 1 },
      { player: 1, step: 0 },
    ])
    expect(SMITE_RULES.owed([[1000], [2000]], live)).toEqual([])
  })

  it('has a bot that usually smites in range, but not perfectly', () => {
    let hits = 0
    let total = 0
    for (let seed = 0; seed < 300; seed++) {
      const duel = smiteDuel('baron', seed)
      const result = smiteResult(duel, botSmite(duel, seed) / 1000)
      if (result.outcome === 'hit') hits += 1
      total += result.score
    }
    expect(hits / 300).toBeGreaterThan(0.8)
    expect(total / 300).toBeGreaterThan(55)
    expect(total / 300).toBeLessThan(85)
  })
})
