import { seededRandom, type RandomFn } from '../random'
import { stepSeed, type BothMoves, type GameSetup, type MiniGameRules, type Moves, type Owed, type Player, type Settled } from './versus'

/**
 * Garen, Demacian Justice: eight low-health enemies pop up one after another, each for a blink
 * only. Tap one in time and the giant sword falls on it. Kills in a row are a streak, and each
 * kill is worth its place in the streak up to a pentakill: a kill 1, a double kill 2... a
 * pentakill 5, and every kill in a row after that 5 again. A miss ends the streak; the next kill
 * starts a new one. All eight is near impossible: the last ones are up for less time than most
 * people need to react.
 *
 * A move is the reaction time in ms from the enemy showing up to the tap, or MISSED.
 */
export const EXECUTE = {
  enemies: 8,
  /** How long each enemy is up, in ms: shorter every time. */
  windowsMs: [700, 640, 580, 530, 480, 440, 400, 370],
  /** The wait before each enemy shows (after the last one died or escaped), in ms. */
  gapMs: { min: 150, max: 750 },
  /** Enemies show up on a 3 by 3 grid. */
  columns: 3,
  rows: 3,
} as const

/** A pentakill is the top of the streak: later kills in a row are worth this much too. */
export const MAX_STREAK_POINTS = 5

/** A move for an enemy that escaped: no tap in time, or a tap beside it. */
export const MISSED = 60_000

/** Squishy carries and mages, low on health: perfect targets for Demacian Justice. */
export const EXECUTE_TARGETS = [
  'Jinx',
  'Lux',
  'Ezreal',
  'Ahri',
  'Teemo',
  'Yuumi',
  'Zoe',
  'Annie',
  'Kaisa',
  'Caitlyn',
  'Sona',
  'Lulu',
  'Draven',
  'Katarina',
  'Seraphine',
  'MissFortune',
  'Tristana',
  'Ashe',
  'Akali',
  'Ekko',
] as const

export interface ExecuteEnemy {
  champion: string
  /** Grid cell, 0–8, left to right and top to bottom. */
  spot: number
  /** Wait before it shows, in ms. */
  gapMs: number
  /** How long it stays up, in ms. */
  windowMs: number
}

const between = (min: number, max: number, random: RandomFn) => Math.round(min + random() * (max - min))

/** A different cell than `not`, picked at random. */
const otherCell = (not: number, random: RandomFn) => {
  const cells = EXECUTE.columns * EXECUTE.rows
  return (not + 1 + Math.floor(random() * (cells - 1))) % cells
}

/** The enemies of a game, the same for both players: different champions, never the same spot twice in a row. */
export function executeWave(seed: number): ExecuteEnemy[] {
  const random = seededRandom(stepSeed(seed, 0, 61))
  const pool: string[] = [...EXECUTE_TARGETS]
  let lastSpot = -1
  return EXECUTE.windowsMs.map((windowMs) => {
    const [champion = 'Jinx'] = pool.splice(Math.floor(random() * pool.length), 1)
    const spot = otherCell(lastSpot, random)
    lastSpot = spot
    const gapMs = between(EXECUTE.gapMs.min, EXECUTE.gapMs.max, random)
    return { champion, spot, gapMs, windowMs }
  })
}

/** A tap counts as a kill only within the enemy's window. */
export const isKill = (move: number | undefined, windowMs: number): move is number =>
  move !== undefined && move >= 0 && move <= windowMs

export interface EnemyResult {
  kill: boolean
  /** ms from showing up to the tap, for a kill. */
  reaction: number | null
  /** The kill's place in the streak (1 = kill, 2 = double kill... 5 = pentakill, and on), 0 for a miss. */
  streak: number
}

/** What a kill is worth: its place in the streak, at most a pentakill's 5. */
export const killPoints = (streak: number): number => Math.min(streak, MAX_STREAK_POINTS)

/** What happened to each enemy a player has played so far. */
export function enemyResults(moves: Moves, wave: readonly ExecuteEnemy[]): EnemyResult[] {
  const results: EnemyResult[] = []
  let streak = 0
  for (const [index, enemy] of wave.entries()) {
    const move = moves[index]
    if (move === undefined) break
    const kill = isKill(move, enemy.windowMs)
    streak = kill ? streak + 1 : 0
    results.push({ kill, reaction: kill ? move : null, streak })
  }
  return results
}

export interface ExecuteScore {
  /** Each kill is worth its place in the streak (at most 5): 15 for a pentakill, 30 for all eight. */
  points: number
  kills: number
  bestStreak: number
  /** All kills' reaction times added up, in ms: the tie-break. */
  time: number
}

export function executeScore(results: readonly EnemyResult[]): ExecuteScore {
  return {
    points: results.reduce((total, { streak }) => total + killPoints(streak), 0),
    kills: results.filter(({ kill }) => kill).length,
    bestStreak: Math.max(0, ...results.map(({ streak }) => streak)),
    time: results.reduce((total, { reaction }) => total + (reaction ?? 0), 0),
  }
}

/** Most points wins; then more kills; then the faster kills. Equal on all three is a tie. */
export function compareScores(a: ExecuteScore, b: ExecuteScore): Player | null {
  if (a.points !== b.points) return a.points > b.points ? 0 : 1
  if (a.kills !== b.kills) return a.kills > b.kills ? 0 : 1
  if (a.time !== b.time) return a.time < b.time ? 0 : 1
  return null
}

/** Both players' scores once both have played every enemy, otherwise null. */
export function finalScores(moves: BothMoves, seed: number): [ExecuteScore, ExecuteScore] | null {
  const wave = executeWave(seed)
  const mine = enemyResults(moves[0], wave)
  const theirs = enemyResults(moves[1], wave)
  if (mine.length < wave.length || theirs.length < wave.length) return null
  return [executeScore(mine), executeScore(theirs)]
}

/**
 * One number per player for the result card and the personal best: points, then kills, then
 * speed, so higher is always better and "15 pts · 2.4 s" shows why a tie on points was won.
 */
const POINTS_BASE = 100_000
const KILLS_BASE = 10_000

export function packScore({ points, kills, time }: ExecuteScore): number {
  if (kills === 0) return 0
  return points * POINTS_BASE + kills * KILLS_BASE + (KILLS_BASE - 1 - Math.min(KILLS_BASE - 1, time))
}

const pointsOf = (score: number) => Math.floor(score / POINTS_BASE)
const timeOf = (score: number) => KILLS_BASE - 1 - (score % KILLS_BASE)

function settle(moves: BothMoves, { seed }: GameSetup): Settled | null {
  const scores = finalScores(moves, seed)
  if (!scores) return null
  const [a, b] = scores
  return { winner: compareScores(a, b), scores: [packScore(a), packScore(b)] }
}

function owed(moves: BothMoves): Owed[] {
  return ([0, 1] as const).flatMap((player) => {
    const missing = moves[player].findIndex((move) => move === undefined)
    const next = missing === -1 ? moves[player].length : missing
    return next < EXECUTE.enemies ? [{ player, step: next }] : []
  })
}

/**
 * Vayne, the bot: quick but greedy. She reacts in 0.32–0.66 s, too slow for most of the last
 * enemies, and sometimes taps at nothing. About 4 kills of 8 a game.
 */
export const BOT_EXECUTE = { reaction: { min: 320, max: 660 }, missChance: 0.05, missPerEnemy: 0.02 } as const

export function botExecute(seed: number, step: number): number | undefined {
  const enemy = executeWave(seed)[step]
  if (!enemy) return undefined
  const random = seededRandom(stepSeed(seed, step, 67))
  if (random() < BOT_EXECUTE.missChance + BOT_EXECUTE.missPerEnemy * step) return MISSED
  const reaction = between(BOT_EXECUTE.reaction.min, BOT_EXECUTE.reaction.max, random)
  return reaction <= enemy.windowMs ? reaction : MISSED
}

/** The longest a wave can take: every enemy's longest wait and its whole window. */
const longestWaveSeconds = (EXECUTE.enemies * EXECUTE.gapMs.max + EXECUTE.windowsMs.reduce((total, ms) => total + ms, 0)) / 1000

/** A space that never breaks, so a number stays with its unit on a narrow card. */
const NBSP = '\u00a0'

const formatPoints = (points: number) => `${points}${NBSP}${points === 1 ? 'pt' : 'pts'}`

/** "10 pts · 2.4 s": the points, and how long the kills took in total. Each value stays on one line. */
export const formatExecuteScore = (score: number): string =>
  score === 0 ? formatPoints(0) : `${formatPoints(pointsOf(score))} · ${(timeOf(score) / 1000).toFixed(1)}${NBSP}s`

export const EXECUTE_RULES: MiniGameRules = {
  chances: 1,
  // A 3-2-1, the wave, and a moment for the last call.
  liveSeconds: () => Math.ceil(3 + longestWaveSeconds + 3),
  owed,
  settle,
  fallback: () => MISSED,
  botMove: (step, _moves, { seed }) => botExecute(seed, step),
  formatScore: (score) => formatExecuteScore(score),
  best: { of: (moves, setup) => settle(moves, setup)?.scores[0] ?? null, lowerIsBetter: false, format: formatExecuteScore },
}
