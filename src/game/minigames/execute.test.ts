import { describe, expect, it } from 'vitest'
import { gameData } from '../../data'
import {
  BOT_EXECUTE,
  botExecute,
  compareScores,
  packScore,
  enemyResults,
  EXECUTE,
  EXECUTE_RULES,
  EXECUTE_TARGETS,
  executeScore,
  executeWave,
  isKill,
  MISSED,
  type ExecuteScore,
} from './execute'
import { soloSetup, type BothMoves, type GameSetup } from './versus'

const SEED = 7
const wave = executeWave(SEED)
const live: GameSetup = { seed: SEED, variant: 'live', bothRoles: false, late: false }
/** A kill at 300 ms, or a miss. */
const play = (pattern: string): number[] => [...pattern].map((mark) => (mark === 'K' ? 300 : MISSED))
const score = (pattern: string) => executeScore(enemyResults(play(pattern), wave))

describe('the wave', () => {
  it('is the same for both players and has five different real champions', () => {
    expect(executeWave(SEED)).toEqual(wave)
    expect(wave).toHaveLength(EXECUTE.enemies)
    expect(new Set(wave.map(({ champion }) => champion)).size).toBe(EXECUTE.enemies)
    const ids = new Set(gameData.champions.map(({ id }) => id))
    for (const id of EXECUTE_TARGETS) expect(ids).toContain(id)
  })

  it('never shows two enemies in a row on the same spot, and each is up a little shorter', () => {
    for (let seed = 0; seed < 200; seed++) {
      const enemies = executeWave(seed)
      enemies.forEach((enemy, index) => {
        expect(enemy.spot).toBeGreaterThanOrEqual(0)
        expect(enemy.spot).toBeLessThan(EXECUTE.columns * EXECUTE.rows)
        expect(enemy.gapMs).toBeGreaterThanOrEqual(EXECUTE.gapMs.min)
        expect(enemy.gapMs).toBeLessThanOrEqual(EXECUTE.gapMs.max)
        const before = enemies[index - 1]
        if (before) {
          expect(enemy.spot).not.toBe(before.spot)
          expect(enemy.windowMs).toBeLessThan(before.windowMs)
        }
      })
    }
  })
})

describe('kills and streaks', () => {
  it('counts a tap as a kill only within the window', () => {
    expect(isKill(0, 640)).toBe(true)
    expect(isKill(640, 640)).toBe(true)
    expect(isKill(641, 640)).toBe(false)
    expect(isKill(MISSED, 640)).toBe(false)
    expect(isKill(undefined, 640)).toBe(false)
  })

  it('numbers each kill by its place in the streak, and a miss ends the streak', () => {
    expect(enemyResults(play('KKMKK'), wave).map(({ streak }) => streak)).toEqual([1, 2, 0, 1, 2])
  })

  it('stops at the first enemy not played yet', () => {
    expect(enemyResults([300, undefined, 300], wave)).toHaveLength(1)
  })

  it('scores each kill by its streak: a pentakill is 15', () => {
    expect(score('KKKKK')).toMatchObject({ points: 15, kills: 5, bestStreak: 5 })
    expect(score('KKKKM')).toMatchObject({ points: 10, kills: 4, bestStreak: 4 })
    expect(score('KMKMK')).toMatchObject({ points: 3, kills: 3, bestStreak: 1 })
    expect(score('MMMMM')).toMatchObject({ points: 0, kills: 0, bestStreak: 0, time: 0 })
  })

  it('adds up the reaction times of the kills only', () => {
    const late = (wave[0]?.windowMs ?? 0) + 1
    expect(executeScore(enemyResults([250, 400, late, MISSED, 310], wave)).time).toBe(960)
  })
})

describe('the winner', () => {
  const s = (points: number, kills: number, time: number): ExecuteScore => ({ points, kills, bestStreak: 0, time })

  it('goes to the most points, then the most kills, then the fastest kills', () => {
    expect(compareScores(s(10, 4, 2000), s(9, 5, 1000))).toBe(0)
    expect(compareScores(s(3, 2, 500), s(3, 3, 900))).toBe(1)
    expect(compareScores(s(6, 3, 1200), s(6, 3, 1100))).toBe(1)
    expect(compareScores(s(6, 3, 1200), s(6, 3, 1200))).toBeNull()
  })

  it('settles once both played all five, with points, kills and speed in one score', () => {
    const moves: BothMoves = [play('KKKKM'), play('KMKKK')]
    expect(EXECUTE_RULES.settle([play('KKKKM'), play('KMKK')], live)).toBeNull()
    const settled = EXECUTE_RULES.settle(moves, live)
    expect(settled?.winner).toBe(0)
    expect(settled?.scores.map((score) => EXECUTE_RULES.formatScore(score, live).split(' · ')[0])).toEqual(['10 pts', '7 pts'])
  })

  it('packs the score so higher is always better, and shows the time for a tie on points', () => {
    expect(packScore(s(6, 3, 1100))).toBeGreaterThan(packScore(s(6, 3, 1200)))
    expect(packScore(s(6, 4, 3000))).toBeGreaterThan(packScore(s(6, 3, 100)))
    expect(packScore(s(7, 3, 4000))).toBeGreaterThan(packScore(s(6, 5, 100)))
    expect(packScore(s(0, 0, 0))).toBe(0)
    expect(EXECUTE_RULES.formatScore(packScore(s(15, 5, 2400)), live)).toBe('15 pts · 2.4 s')
    expect(EXECUTE_RULES.formatScore(0, live)).toBe('0 pts')
  })

  it('calls equal waves a tie', () => {
    expect(EXECUTE_RULES.settle([play('MMMMM'), play('MMMMM')], live)?.winner).toBeNull()
  })

  it('owes each player their next enemy until all five are played', () => {
    expect(EXECUTE_RULES.owed([[], play('KK')], live)).toEqual([
      { player: 0, step: 0 },
      { player: 1, step: 2 },
    ])
    expect(EXECUTE_RULES.owed([play('KKKKK'), play('KKKKK')], live)).toEqual([])
  })

  it('fills in a miss for a player who never answers', () => {
    expect(EXECUTE_RULES.fallback({ player: 0, step: 0 }, [[], []], live)).toBe(MISSED)
  })

  it('keeps your points (then speed) as the personal best', () => {
    const setup = soloSetup(SEED)
    const best = EXECUTE_RULES.best?.of([play('KKKMK'), play('MMMMM')], setup) ?? 0
    expect(EXECUTE_RULES.best?.format(best)).toMatch(/^7 pts · \d\.\d s$/)
    expect(EXECUTE_RULES.formatScore(packScore(s(1, 1, 500)), setup)).toBe('1 pt · 0.5 s')
  })

  it('fits the whole wave in the Multiplayer time limit', () => {
    const longest = wave.reduce((total, { gapMs, windowMs }) => total + gapMs + windowMs, 0) / 1000
    expect(EXECUTE_RULES.liveSeconds(live)).toBeGreaterThan(longest + 3)
  })
})

describe('the bot', () => {
  it('only ever answers with a kill in time or a miss', () => {
    for (let seed = 0; seed < 50; seed++) {
      executeWave(seed).forEach((enemy, step) => {
        const move = botExecute(seed, step)
        expect(move === MISSED || (move !== undefined && move >= BOT_EXECUTE.reaction.min && move <= enemy.windowMs)).toBe(true)
      })
      expect(botExecute(seed, EXECUTE.enemies)).toBeUndefined()
    }
  })

  it('gets about 3 to 4 kills a game', () => {
    let kills = 0
    const games = 400
    for (let seed = 0; seed < games; seed++) {
      const moves = Array.from({ length: EXECUTE.enemies }, (_, step) => botExecute(seed, step))
      kills += executeScore(enemyResults(moves, executeWave(seed))).kills
    }
    expect(kills / games).toBeGreaterThan(3)
    expect(kills / games).toBeLessThan(4.2)
  })
})
