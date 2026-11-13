import { describe, expect, it } from 'vitest'
import { seededRandom } from '../random'
import {
  BOT_SMITE,
  botSmite,
  duelOfStep,
  hpAt,
  LONGEST_SMITE_DUEL,
  NO_SMITE,
  SMITE_LEAD_IN,
  SMITE_RULES,
  smiteDuel,
  smiteMood,
  smiteResult,
  smiteTargets,
  timeAtHp,
  type SmiteDuel,
  type SmiteMood,
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

  it('drains smoothly: no jumps between two frames, even in a burst', () => {
    for (const duel of duels) {
      // The health is straight lines between the points, so the steepest line is the biggest drop per frame.
      const steepest = Math.max(
        ...duel.points.slice(1).map((point, index) => {
          const before = duel.points[index] ?? point
          return (before.hp - point.hp) / (point.at - before.at)
        }),
      )
      expect(steepest / 60).toBeLessThan(0.03)
      expect(hpAt(duel, duel.rangeAt / 2) - hpAt(duel, duel.rangeAt / 2 + 1 / 60)).toBeLessThan(0.03)
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

describe('bursts and timeAtHp', () => {
  const lastPace = (duel: SmiteDuel) => {
    const [before, last] = duel.points.slice(-2)
    return before && last ? (before.hp - last.hp) / (last.at - before.at) : 0
  }
  const fastestEarlier = (duel: SmiteDuel) => {
    const inRange = duel.points.filter(({ at }) => at >= duel.rangeAt).slice(0, -1)
    return Math.max(...inRange.slice(1).map((point, index) => ((inRange[index]?.hp ?? 0) - point.hp) / (point.at - (inRange[index]?.at ?? 0))))
  }

  it('sometimes ends in a burst faster than anything before it, sometimes not', () => {
    const bursts = duels.filter((duel) => lastPace(duel) > fastestEarlier(duel) * 1.1).length / duels.length
    expect(bursts).toBeGreaterThan(0.3)
    expect(bursts).toBeLessThan(0.75)
  })

  it('finds the moment the health is down to a value', () => {
    for (const duel of duels.slice(0, 40)) {
      const at = timeAtHp(duel, duel.threshold / 2)
      expect(hpAt(duel, at)).toBeCloseTo(duel.threshold / 2, 5)
      expect(at).toBeGreaterThan(duel.rangeAt)
      expect(at).toBeLessThan(duel.deathAt)
      expect(timeAtHp(duel, duel.threshold)).toBeCloseTo(duel.rangeAt, 5)
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

  it('has a bot in a different mood each duel, so there is no single answer to learn', () => {
    const moods = new Map<SmiteMood, number>()
    const random = seededRandom(3)
    for (let index = 0; index < 2000; index++) {
      const mood = smiteMood(random)
      moods.set(mood, (moods.get(mood) ?? 0) + 1)
    }
    for (const [mood, { chance }] of Object.entries(BOT_SMITE.moods)) {
      expect((moods.get(mood as SmiteMood) ?? 0) / 2000).toBeCloseTo(chance, 1)
    }
  })

  it('has a bot that is sometimes greedy and very low, sometimes safe and high', () => {
    const shares: number[] = []
    for (let seed = 0; seed < 600; seed++) {
      const duel = smiteDuel(seed % 2 ? 'baron' : 'elder', seed)
      const result = smiteResult(duel, botSmite(duel, seed * 31 + 5) / 1000)
      if (result.outcome === 'hit') shares.push(result.hp / 1200)
    }
    expect(shares.filter((share) => share < 0.12).length / shares.length).toBeGreaterThan(0.2)
    expect(shares.filter((share) => share > 0.5).length / shares.length).toBeGreaterThan(0.15)
  })
})
