import { describe, expect, it } from 'vitest'
import { makeChampion } from '../testUtils'
import {
  angleTo,
  botGoldAt,
  botGrabs,
  championProfile,
  fireHook,
  FIELD,
  HOOK,
  HOOK_SECONDS,
  HOOK_ORIGIN,
  hookField,
  hookGold,
  maxReach,
  swingAngle,
  type HookTarget,
} from './hook'

const pool = ['Jinx', 'Malphite', 'Ahri', 'Zed', 'Leona', 'Garen', 'Lux'].map((id, index) =>
  makeChampion({ id, classes: [(['Marksman', 'Tank', 'Mage', 'Assassin', 'Support', 'Fighter', 'Mage'] as const)[index] ?? 'Mage'] }),
)

const target = (overrides: Partial<HookTarget>): HookTarget => ({
  id: 't',
  kind: 'champion',
  champion: null,
  x: 50,
  y: 40,
  radius: 4,
  value: 300,
  pullSpeed: 80,
  ...overrides,
})

describe('hookField', () => {
  it('places 3 or 5 champions and the minions without overlaps, inside the field', () => {
    for (let seed = 0; seed < 50; seed++) {
      const field = hookField(seed, pool)
      const champions = field.filter((t) => t.kind === 'champion')
      expect([3, 5]).toContain(champions.length)
      for (const a of field) {
        expect(a.x - a.radius).toBeGreaterThan(0)
        expect(a.x + a.radius).toBeLessThan(FIELD.width)
        expect(a.y + a.radius).toBeLessThan(FIELD.height)
        for (const b of field) {
          if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.radius + b.radius)
        }
      }
    }
  })

  it('is the same for the same seed', () => {
    expect(hookField(3, pool).map((t) => t.id)).toEqual(hookField(3, pool).map((t) => t.id))
  })
})

describe('target profiles', () => {
  it('makes carries worth more and lighter than tanks', () => {
    const carry = championProfile(makeChampion({ classes: ['Marksman'] }))
    const tank = championProfile(makeChampion({ classes: ['Tank'] }))
    expect(carry.value).toBeGreaterThan(tank.value)
    expect(carry.pullSpeed).toBeGreaterThan(tank.pullSpeed)
    expect(tank.radius).toBeGreaterThan(carry.radius)
  })
})

describe('swing and aim', () => {
  it('swings between -maxAngle and +maxAngle', () => {
    expect(swingAngle(0)).toBe(0)
    expect(swingAngle(HOOK.swingPeriod / 4)).toBeCloseTo(HOOK.maxAngle)
    expect(swingAngle((HOOK.swingPeriod * 3) / 4)).toBeCloseTo(-HOOK.maxAngle)
  })

  it('reaches the bottom when aiming straight down', () => {
    expect(maxReach(0)).toBeCloseTo(FIELD.height - HOOK_ORIGIN.y)
  })

  it('points at a spot', () => {
    expect(angleTo({ x: 50, y: 40 })).toBeCloseTo(0)
    expect(angleTo({ x: 80, y: HOOK_ORIGIN.y + 30 })).toBeCloseTo(45)
  })
})

describe('fireHook', () => {
  it('grabs a target in its path and stops at its edge', () => {
    const shot = fireHook([target({})], 0)
    expect(shot.target?.id).toBe('t')
    expect(shot.length).toBeCloseTo(40 - 4 - HOOK_ORIGIN.y)
  })

  it('grabs the nearest of two targets in a line: minions block the way', () => {
    const minion = target({ id: 'minion', kind: 'minion', y: 25, value: 20 })
    expect(fireHook([target({}), minion], 0).target?.id).toBe('minion')
  })

  it('misses targets off its line and flies to the edge of the field', () => {
    const shot = fireHook([target({ x: 80 })], 0)
    expect(shot.target).toBeNull()
    expect(shot.length).toBeCloseTo(maxReach(0))
  })

  it('pulls heavy targets back slower', () => {
    const light = fireHook([target({ pullSpeed: 80 })], 0)
    const heavy = fireHook([target({ pullSpeed: 30 })], 0)
    expect(heavy.backTime).toBeGreaterThan(light.backTime)
    expect(heavy.outTime).toBeCloseTo(light.outTime)
  })
})

describe('gold', () => {
  it('adds up the value of everything grabbed', () => {
    expect(hookGold([target({ value: 300 }), target({ value: 20 })])).toBe(320)
  })
})

describe('botGrabs', () => {
  it('only counts grabs that are back before the time runs out, each target once', () => {
    for (let seed = 0; seed < 30; seed++) {
      const field = hookField(seed, pool)
      const grabs = botGrabs(field, seed)
      expect(grabs.every(({ at }) => at <= HOOK_SECONDS.solo)).toBe(true)
      expect(new Set(grabs.map(({ target: t }) => t.id)).size).toBe(grabs.length)
    }
  })

  it('usually grabs some champions, and its gold grows over time', () => {
    const field = hookField(1, pool)
    const grabs = botGrabs(field, 1)
    expect(grabs.some(({ target: t }) => t.kind === 'champion')).toBe(true)
    expect(botGoldAt(grabs, 0)).toBe(0)
    expect(botGoldAt(grabs, HOOK_SECONDS.solo)).toBe(hookGold(grabs.map(({ target: t }) => t)))
  })
})
