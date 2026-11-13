import { seededRandom, type RandomFn } from '../random'
import { stepSeed, type BothMoves, type GameSetup, type MiniGameRules, type Moves, type Owed, type Player, type Settled } from './versus'

/**
 * Darius, five ults: five low-health enemies pop up one after another, each for a moment only.
 * Tap one in time and Noxian Guillotine executes it. Kills in a row are a streak, and each kill
 * is worth its place in the streak: a kill 1, a double kill 2... a pentakill 5, so all five in a
 * row score 15. A miss ends the streak; the next kill starts a new one.
 *
 * A move is the reaction time in ms from the enemy showing up to the tap, or MISSED.
 */
export const EXECUTE = {
  enemies: 5,
  /** How long each enemy is up, in ms: a little shorter every time. */
  windowsMs: [950, 820, 720, 630, 560],
  /** The wait before each enemy shows (after the last one died or escaped), in ms. */
  gapMs: { min: 450, max: 1400 },
  /** Enemies show up on a 3 by 3 grid. */
  columns: 3,
  rows: 3,
} as const

/** A move for an enemy that escaped: no tap in time, or a tap beside it. */
export const MISSED = 60_000

/** Squishy carries and mages, low on health: perfect Guillotine targets. */
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
  'Vayne',
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

/** The five enemies of a game, the same for both players: different champions, never the same spot twice in a row. */
export function executeWave(seed: number): ExecuteEnemy[] {
  const random = seededRandom(stepSeed(seed, 0, 61))
  const pool: string[] = [...EXECUTE_TARGETS]
  const cells = EXECUTE.columns * EXECUTE.rows
  let lastSpot = -1
  return EXECUTE.windowsMs.map((windowMs) => {
    const [champion = 'Jinx'] = pool.splice(Math.floor(random() * pool.length), 1)
    const spot = (lastSpot + 1 + Math.floor(random() * (cells - 1))) % cells
    lastSpot = spot
    return { champion, spot, gapMs: between(EXECUTE.gapMs.min, EXECUTE.gapMs.max, random), windowMs }
  })
}

/** A tap counts as a kill only within the enemy's window. */
export const isKill = (move: number | undefined, windowMs: number): move is number =>
  move !== undefined && move >= 0 && move <= windowMs

export interface EnemyResult {
  kill: boolean
  /** ms from showing up to the tap, for a kill. */
  reaction: number | null
  /** The kill's place in the streak (1 = kill, 2 = double kill... 5 = pentakill), 0 for a miss. */
  streak: number
}

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
  /** Each kill is worth its place in the streak: 15 for a pentakill. */
  points: number
  kills: number
  bestStreak: number
  /** All kills' reaction times added up, in ms: the tie-break. */
  time: number
}

export function executeScore(results: readonly EnemyResult[]): ExecuteScore {
  return {
    points: results.reduce((total, { streak }) => total + streak, 0),
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

function settle(moves: BothMoves, { seed }: GameSetup): Settled | null {
  const scores = finalScores(moves, seed)
  if (!scores) return null
  const [a, b] = scores
  return { winner: compareScores(a, b), scores: [a.points, b.points] }
}

function owed(moves: BothMoves): Owed[] {
  return ([0, 1] as const).flatMap((player) => {
    const missing = moves[player].findIndex((move) => move === undefined)
    const next = missing === -1 ? moves[player].length : missing
    return next < EXECUTE.enemies ? [{ player, step: next }] : []
  })
}

/**
 * Draven, the bot: quick but greedy. He reacts in 0.40–0.68 s, often too slow for the last enemies,
 * and sometimes swings at nothing. About 3–4 kills a game.
 */
export const BOT_EXECUTE = { reaction: { min: 400, max: 680 }, missChance: 0.1, missPerEnemy: 0.04 } as const

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

const formatPoints = (points: number) => `${points} ${points === 1 ? 'pt' : 'pts'}`

export const EXECUTE_RULES: MiniGameRules = {
  chances: 1,
  // A 3-2-1, the wave, and a moment for the last call.
  liveSeconds: () => Math.ceil(3 + longestWaveSeconds + 3),
  owed,
  settle,
  fallback: () => MISSED,
  botMove: (step, _moves, { seed }) => botExecute(seed, step),
  formatScore: (score) => formatPoints(score),
  best: { of: (moves, setup) => settle(moves, setup)?.scores[0] ?? null, lowerIsBetter: false, format: formatPoints },
}
