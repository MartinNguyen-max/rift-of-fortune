import { describe, expect, it } from 'vitest'
import { seededRandom } from '../random'
import {
  BOT_SMITE,
  botSmite,
  fightOfStep,
  fightWinner,
  hpAt,
  LONGEST_SMITE_FIGHT,
  NO_SMITE,
  SMITE_DAMAGE,
  SMITE_HITS,
  SMITE_LEAD_IN,
  SMITE_RULES,
  smiteFight,
  smiteMood,
  smiteResult,
  smiteTargets,
  type SmiteFight,
  type SmiteMood,
} from './smite'
import { soloSetup, type GameSetup } from './versus'

const fights: SmiteFight[] = Array.from({ length: 300 }, (_, seed) => smiteFight(seed % 2 ? 'baron' : 'elder', seed))
/** Score text with its non-breaking spaces as plain ones. */
const plain = (text: string) => text.replaceAll('\u00a0', ' ')
const quantile = (values: number[], share: number) => [...values].sort((a, b) => a - b)[Math.floor(share * (values.length - 1))] ?? 0

describe('smiteFight', () => {
  it('is the same for both players with the same seed', () => {
    expect(smiteFight('baron', 7)).toEqual(smiteFight('baron', 7))
    expect(smiteFight('baron', 8)).not.toEqual(smiteFight('baron', 7))
  })

  it('drops in small, quick hits all the way to 0: no big jumps, no long pauses', () => {
    for (const fight of fights) {
      expect(hpAt(fight, 0)).toBe(fight.startHp)
      expect(hpAt(fight, SMITE_LEAD_IN - 0.01)).toBe(fight.startHp)
      let hp = fight.startHp
      let at = SMITE_LEAD_IN
      for (const hit of fight.hits) {
        expect(hp - hit.hp).toBeGreaterThan(0)
        expect(hp - hit.hp).toBeLessThanOrEqual(SMITE_HITS.maxDamage)
        // Times are rounded to whole ms.
        expect(hit.at - at).toBeLessThanOrEqual(SMITE_HITS.gap.max + 0.001)
        hp = hit.hp
        at = hit.at
      }
      expect(hp).toBe(0)
      expect(hpAt(fight, fight.deathAt)).toBe(0)
    }
  })

  it('drops to Smite’s 1,600 at a moment you can’t learn, then dies about a second later', () => {
    for (const fight of fights) {
      expect(hpAt(fight, fight.lineAt)).toBeLessThanOrEqual(SMITE_DAMAGE)
      expect(hpAt(fight, fight.lineAt - 0.001)).toBeGreaterThan(SMITE_DAMAGE)
      expect(fight.deathAt - fight.lineAt).toBeGreaterThan(0.4)
      expect(fight.deathAt - fight.lineAt).toBeLessThan(2.2)
      expect(fight.deathAt).toBeLessThanOrEqual(LONGEST_SMITE_FIGHT)
    }
    const lines = fights.map(({ lineAt }) => lineAt)
    expect(quantile(lines, 0.9) - quantile(lines, 0.1)).toBeGreaterThan(1)
    const windows = fights.filter(({ target }) => target === 'baron').map(({ lineAt, deathAt }) => deathAt - lineAt)
    expect(quantile(windows, 0.5)).toBeGreaterThan(0.9)
    expect(quantile(windows, 0.5)).toBeLessThan(1.4)
  })
})

describe('smiteResult', () => {
  const fight = smiteFight('baron', 3)

  it('does nothing above 1,600 health: too early', () => {
    expect(smiteResult(fight, SMITE_LEAD_IN / 2)).toEqual({ outcome: 'early', hp: fight.startHp, reaction: null })
    expect(smiteResult(fight, fight.lineAt - 0.001)).toMatchObject({ outcome: 'early', reaction: null })
  })

  it('kills it at 1,600 or less, timed from the moment it got there', () => {
    expect(smiteResult(fight, fight.lineAt)).toMatchObject({ outcome: 'hit', reaction: 0 })
    const later = smiteResult(fight, fight.lineAt + 0.312)
    expect(later.outcome).toBe('hit')
    expect(later.reaction).toBe(312)
    expect(later.hp).toBeLessThanOrEqual(SMITE_DAMAGE)
  })

  it('is too late once the teams killed it, or without a smite', () => {
    expect(smiteResult(fight, fight.deathAt)).toEqual({ outcome: 'late', hp: 0, reaction: null })
    expect(smiteResult(fight, null)).toMatchObject({ outcome: 'late' })
  })
})

describe('fightWinner', () => {
  const hit = (reaction: number) => ({ outcome: 'hit' as const, hp: 900, reaction })
  const early = { outcome: 'early' as const, hp: 2100, reaction: null }
  const late = { outcome: 'late' as const, hp: 0, reaction: null }

  it('gives it to the first smite that kills it', () => {
    expect(fightWinner(hit(250), hit(300))).toBe(0)
    expect(fightWinner(hit(410), hit(300))).toBe(1)
  })

  it('gives it to the only smite that kills it, and to nobody when none does or both are equal', () => {
    expect(fightWinner(early, hit(600))).toBe(1)
    expect(fightWinner(hit(600), late)).toBe(0)
    expect(fightWinner(early, late)).toBeNull()
    expect(fightWinner(hit(300), hit(300))).toBeNull()
  })
})

describe('SMITE_RULES', () => {
  const solo = soloSetup(9)
  const live: GameSetup = { seed: 9, variant: 'live', bothRoles: false, late: false }
  /** A smite `reaction` seconds after the line in that step's fight (negative: before it). */
  const at = (setup: GameSetup, step: number, reaction: number) => {
    const fight = fightOfStep(setup, step)
    if (!fight) throw new Error('No fight')
    return Math.round((fight.lineAt + reaction) * 1000)
  }

  it('plays Baron then Elder solo, and one target live (Elder when late)', () => {
    expect(smiteTargets(solo)).toEqual(['baron', 'elder'])
    expect(smiteTargets(live)).toEqual(['baron'])
    expect(smiteTargets({ ...live, late: true })).toEqual(['elder'])
  })

  it('waits for every fight, then the most steals wins', () => {
    expect(SMITE_RULES.settle([[at(solo, 0, 0.3)], [at(solo, 0, 0.4)]], solo)).toBeNull()
    const settled = SMITE_RULES.settle([[at(solo, 0, 0.3), at(solo, 1, 0.3)], [at(solo, 0, 0.4), at(solo, 1, -0.2)]], solo)
    expect(settled?.winner).toBe(0)
    expect(plain(SMITE_RULES.formatScore(settled?.scores[0] ?? 0, solo))).toBe('2 steals · 600 ms')
    expect(SMITE_RULES.formatScore(settled?.scores[1] ?? 0, solo)).toBe('No steal')
    // On a narrow card the score wraps between the steals and the time, never inside them.
    expect(SMITE_RULES.formatScore(settled?.scores[0] ?? 0, solo)).toMatch(/^2\u00a0steals · 600\u00a0ms$/)
  })

  it('breaks a tie on steals with the faster steals', () => {
    // You steal Baron in 250 ms; they steal Elder in 380 ms after your early smite.
    const settled = SMITE_RULES.settle([[at(solo, 0, 0.25), at(solo, 1, -0.2)], [at(solo, 0, 0.3), at(solo, 1, 0.38)]], solo)
    expect(settled?.winner).toBe(0)
    expect(plain(SMITE_RULES.formatScore(settled?.scores[1] ?? 0, solo))).toBe('1 steal · 380 ms')
  })

  it('is a draw when nobody steals anything', () => {
    expect(SMITE_RULES.settle([[NO_SMITE, at(solo, 1, -0.3)], [at(solo, 0, -0.1), NO_SMITE]], solo)?.winner).toBeNull()
  })

  it('settles the one live fight with the first smite under the line', () => {
    const settled = SMITE_RULES.settle([[at(live, 0, 0.34)], [at(live, 0, 0.29)]], live)
    expect(settled?.winner).toBe(1)
    expect(plain(SMITE_RULES.formatScore(settled?.scores[1] ?? 0, live))).toBe('Stolen · 290 ms')
  })

  it('keeps your fastest smite under the line as the best, even in a fight you lost', () => {
    expect(SMITE_RULES.best?.of([[at(solo, 0, 0.42), at(solo, 1, 0.5)], [at(solo, 0, 0.3), at(solo, 1, 0.31)]], solo)).toBe(420)
    expect(SMITE_RULES.best?.of([[NO_SMITE, at(solo, 1, -0.2)], [at(solo, 0, 0.3), at(solo, 1, 0.31)]], solo)).toBeNull()
    expect(SMITE_RULES.best?.lowerIsBetter).toBe(true)
    expect(SMITE_RULES.best?.format(312)).toBe('312 ms')
  })

  it('owes each player their next fight, and fills in a smite that comes too late', () => {
    expect(SMITE_RULES.owed([[1000], []], solo)).toEqual([
      { player: 0, step: 1 },
      { player: 1, step: 0 },
    ])
    expect(SMITE_RULES.owed([[1000], [2000]], live)).toEqual([])
    const fallback = SMITE_RULES.fallback({ player: 1, step: 0 }, [[], []], live)
    const fight = fightOfStep(live, 0)
    if (fight) expect(smiteResult(fight, fallback / 1000).outcome).toBe('late')
  })

  it('gives Multiplayer enough time for the longest fight', () => {
    expect(SMITE_RULES.liveSeconds(live)).toBeGreaterThanOrEqual(3 + LONGEST_SMITE_FIGHT + 2)
  })
})

describe('Nunu, the bot', () => {
  const results = fights.map((fight, index) => smiteResult(fight, botSmite(fight, index * 31 + 5) / 1000))

  it('picks a different mood each fight, so there is no single answer to learn', () => {
    const moods = new Map<SmiteMood, number>()
    const random = seededRandom(3)
    for (let index = 0; index < 2000; index++) {
      const mood = smiteMood(random)
      moods.set(mood, (moods.get(mood) ?? 0) + 1)
    }
    for (const [mood, { chance }] of Object.entries(BOT_SMITE)) {
      expect((moods.get(mood as SmiteMood) ?? 0) / 2000).toBeCloseTo(chance, 1)
    }
  })

  it('usually kills it, sometimes too early or too late, at very different speeds', () => {
    const share = (outcome: string) => results.filter((result) => result.outcome === outcome).length / results.length
    expect(share('hit')).toBeGreaterThan(0.78)
    expect(share('hit')).toBeLessThan(0.93)
    expect(share('early')).toBeGreaterThan(0.03)
    expect(share('late')).toBeGreaterThan(0.02)
    const reactions = results.flatMap(({ reaction }) => (reaction === null ? [] : [reaction]))
    expect(quantile(reactions, 0.1)).toBeLessThan(260)
    expect(quantile(reactions, 0.9)).toBeGreaterThan(500)
  })

  it('loses more often than not to a good player, but not always', () => {
    const random = seededRandom(5)
    let wins = 0
    fights.forEach((fight, index) => {
      // A good player: about 0.32 s after the line, give or take.
      const mine = smiteResult(fight, fight.lineAt + 0.26 + random() * 0.12)
      if (fightWinner(mine, results[index] ?? mine) === 0) wins += 1
    })
    expect(wins / fights.length).toBeGreaterThan(0.5)
    expect(wins / fights.length).toBeLessThan(0.75)
  })
})
