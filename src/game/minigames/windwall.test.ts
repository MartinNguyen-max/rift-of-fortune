import { describe, expect, it } from 'vitest'
import {
  botWall,
  compareWalls,
  formatWallScore,
  landsAt,
  NO_WALL,
  packWallScore,
  readWall,
  shotResult,
  shotResults,
  WIND_WALL,
  WIND_WALL_RULES,
  windowMs,
  windWallVolley,
  wallMove,
  type Shot,
  type WallScore,
} from './windwall'
import { soloSetup, type BothMoves, type GameSetup, type Moves } from './versus'

const SEED = 777
const live: GameSetup = { seed: SEED, variant: 'live', bothRoles: false, late: false }
const volley = windWallVolley(SEED)
const shot: Shot = { shooter: 'Jinx', spell: 'JinxW.png', side: 1, warnAt: 0, warnMs: 400, flightMs: 700 }

/** Every shot answered the same way: blocked after `ms`, or `wrong` side, or never. */
const answer = (how: 'block' | 'wrong' | 'none', ms = 400): Moves =>
  volley.map(({ side }) => (how === 'none' ? NO_WALL : wallMove(how === 'block' ? side : (((side + 2) % 4) as 0 | 1 | 2 | 3), ms)))

describe('the volley', () => {
  it('is the same for both players, faster each shot, never the same side twice in a row', () => {
    expect(windWallVolley(SEED)).toEqual(volley)
    expect(volley).toHaveLength(WIND_WALL.shots)
    for (let index = 1; index < volley.length; index++) {
      const [previous, current] = [volley[index - 1] as Shot, volley[index] as Shot]
      expect(current.side).not.toBe(previous.side)
      expect(windowMs(current)).toBeLessThan(windowMs(previous))
      // Shots land in order, so they are always answered in order.
      expect(landsAt(current)).toBeGreaterThan(landsAt(previous))
    }
  })

  it('sometimes fires two at once late on, but never three', () => {
    let doubles = 0
    for (let seed = 1; seed <= 300; seed++) {
      const shots = windWallVolley(seed)
      shots.forEach((current, index) => {
        const previous = shots[index - 1]
        if (previous && current.warnAt < landsAt(previous)) {
          doubles += 1
          expect(index).toBeGreaterThanOrEqual(WIND_WALL.double.from)
          const beforePrevious = shots[index - 2]
          expect(beforePrevious === undefined || previous.warnAt >= landsAt(beforePrevious)).toBe(true)
        }
      })
    }
    expect(doubles).toBeGreaterThan(100)
  })
})

describe('a shot', () => {
  it('is blocked by a wall on its side before it lands', () => {
    expect(shotResult(shot, wallMove(1, 350))).toEqual({ outcome: 'blocked', reaction: 350 })
    expect(shotResult(shot, wallMove(1, windowMs(shot)))).toEqual({ outcome: 'blocked', reaction: windowMs(shot) })
  })

  it('hits on the wrong side, after it landed, or without a wall', () => {
    expect(shotResult(shot, wallMove(3, 300)).outcome).toBe('wrong')
    expect(shotResult(shot, wallMove(1, windowMs(shot) + 1)).outcome).toBe('late')
    expect(shotResult(shot, NO_WALL).outcome).toBe('late')
  })

  it('packs the side and the time in one whole number', () => {
    expect(readWall(wallMove(2, 512))).toEqual({ side: 2, ms: 512 })
    expect(readWall(wallMove(0, -40))).toEqual({ side: 0, ms: 0 })
    expect(readWall(NO_WALL)).toBeNull()
  })
})

describe('scoring', () => {
  const score = (blocked: number, time: number): WallScore => ({ blocked, time })

  it('goes to more blocks, then the faster blocks', () => {
    expect(compareWalls(score(9, 6000), score(8, 3000))).toBe(0)
    expect(compareWalls(score(7, 3500), score(7, 3400))).toBe(1)
    expect(compareWalls(score(7, 3500), score(7, 3500))).toBeNull()
  })

  it('packs blocks and speed so higher is better, and shows the average time', () => {
    expect(packWallScore(score(8, 4000))).toBeGreaterThan(packWallScore(score(8, 4100)))
    expect(packWallScore(score(9, 9000))).toBeGreaterThan(packWallScore(score(8, 100)))
    expect(packWallScore(score(0, 0))).toBe(0)
    expect(formatWallScore(packWallScore(score(9, 4500)))).toBe('9/12 · 0.50 s')
    expect(formatWallScore(0)).toBe('0/12')
  })

  it('settles once both answered every shot', () => {
    const moves: BothMoves = [answer('block'), answer('wrong')]
    expect(WIND_WALL_RULES.settle([answer('block').slice(0, 11), answer('block')], live)).toBeNull()
    const settled = WIND_WALL_RULES.settle(moves, live)
    expect(settled?.winner).toBe(0)
    expect(settled?.scores.map((value) => formatWallScore(value))).toEqual(['12/12 · 0.40 s', '0/12'])
    expect(shotResults(answer('none'), volley).every(({ outcome }) => outcome === 'late')).toBe(true)
  })

  it('calls the same blocks at the same speed a tie', () => {
    expect(WIND_WALL_RULES.settle([answer('block', 300), answer('block', 300)], live)?.winner).toBeNull()
  })

  it('owes each player their next shot, and fills in a shot that hit', () => {
    expect(WIND_WALL_RULES.owed([[], answer('block').slice(0, 3)], live)).toEqual([
      { player: 0, step: 0 },
      { player: 1, step: 3 },
    ])
    expect(WIND_WALL_RULES.fallback({ player: 0, step: 0 }, [[], []], live)).toBe(NO_WALL)
  })

  it('keeps blocks, then speed, as the personal best', () => {
    const best = WIND_WALL_RULES.best?.of([answer('block', 500), answer('none')], soloSetup(SEED)) ?? 0
    expect(WIND_WALL_RULES.best?.format(best)).toBe('12/12 · 0.50 s')
  })

  it('fits the whole volley in the Multiplayer time limit', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const shots = windWallVolley(seed)
      const last = shots[shots.length - 1] as Shot
      expect(WIND_WALL_RULES.liveSeconds(live)).toBeGreaterThan(landsAt(last) / 1000 + 3)
    }
  })
})

describe('the bot', () => {
  it('blocks about 8 of 12 and turns the wrong way now and then', () => {
    let blocked = 0
    let wrong = 0
    const games = 1000
    for (let seed = 1; seed <= games; seed++) {
      const shots = windWallVolley(seed)
      shots.forEach((target, step) => {
        const outcome = shotResult(target, botWall(seed, step) ?? NO_WALL).outcome
        if (outcome === 'blocked') blocked += 1
        if (outcome === 'wrong') wrong += 1
      })
    }
    expect(blocked / games).toBeGreaterThan(7)
    expect(blocked / games).toBeLessThan(10.5)
    expect(wrong).toBeGreaterThan(0)
  })
})
