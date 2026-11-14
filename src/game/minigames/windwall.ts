import { seededRandom, type RandomFn } from '../random'
import { stepSeed, type BothMoves, type GameSetup, type MiniGameRules, type Moves, type Owed, type Player, type Settled } from './versus'

/**
 * Yasuo, Wind Wall: champions fire skillshots at Yasuo from the top, right, bottom and left. Each
 * shooter shows up with a short warning, then fires. Put the wall up on that side before the shot
 * lands. Shots come faster and faster, and later sometimes two at once from different sides.
 * Most shots blocked wins; then the faster blocks.
 *
 * A move answers one shot: the side the wall went up on, packed with the ms since the warning
 * (`side * SIDE_BASE + ms`), or NO_WALL when the shot landed first.
 */
export const WIND_WALL = {
  shots: 12,
  /** The warning before each shot fires, in ms: shorter every shot. */
  warnMs: [400, 380, 350, 330, 300, 280, 260, 240, 220, 200, 190, 180],
  /** The shot's flight to Yasuo, in ms. */
  flightMs: [700, 660, 620, 580, 540, 510, 480, 450, 420, 390, 360, 340],
  /** The wait after a shot lands before the next warning, in ms. */
  gapMs: { min: 300, max: 750 },
  /** From the 7th shot on, this often the next shot comes right after, from another side. */
  double: { from: 6, chance: 0.4, offsetMs: { min: 230, max: 380 } },
} as const

/** The four sides, clockwise from the top. */
export const SIDES = ['top', 'right', 'bottom', 'left'] as const
export type Side = 0 | 1 | 2 | 3

/** The side and the time are packed into one move: side × SIDE_BASE + ms. */
export const SIDE_BASE = 10_000

/** A move for a shot that landed before any wall went up. */
export const NO_WALL = 5 * SIDE_BASE

/** Who shoots, and with what. */
export const SHOOTERS = [
  { champion: 'Jinx', spell: 'JinxW.png' },
  { champion: 'Ezreal', spell: 'EzrealQ.png' },
  { champion: 'Caitlyn', spell: 'CaitlynQ.png' },
  { champion: 'Varus', spell: 'VarusQ.png' },
  { champion: 'Lux', spell: 'LuxLightBinding.png' },
  { champion: 'Ashe', spell: 'EnchantedCrystalArrow.png' },
  { champion: 'MissFortune', spell: 'MissFortuneRicochetShot.png' },
  { champion: 'Draven', spell: 'DravenDoubleShot.png' },
] as const

export interface Shot {
  shooter: string
  /** Data Dragon spell image of the skillshot. */
  spell: string
  side: Side
  /** When the warning shows, in ms since the volley started. */
  warnAt: number
  warnMs: number
  flightMs: number
}

/** When a shot lands, in ms since the volley started. */
export const landsAt = (shot: Shot): number => shot.warnAt + shot.warnMs + shot.flightMs

/** The time to get the wall up, from the warning until the shot lands. */
export const windowMs = (shot: Shot): number => shot.warnMs + shot.flightMs

const between = (min: number, max: number, random: RandomFn) => Math.round(min + random() * (max - min))
const sideOf = (value: number): Side => (((value % 4) + 4) % 4) as Side

/**
 * The volley, the same for both players. A shot never comes from the same side twice in a row,
 * and a double's second shot always lands after the first, so they are answered in order.
 */
export function windWallVolley(seed: number): Shot[] {
  const random = seededRandom(stepSeed(seed, 0, 79))
  const shots: Shot[] = []
  let side: Side = sideOf(Math.floor(random() * 4))
  let lastDoubled = false
  for (let index = 0; index < WIND_WALL.shots; index++) {
    const previous = shots[index - 1]
    // Never three in the air at once: a double's second shot is never doubled again.
    const doubled: boolean = previous !== undefined && index >= WIND_WALL.double.from && !lastDoubled && random() < WIND_WALL.double.chance
    lastDoubled = doubled
    const warnAt = !previous
      ? 0
      : doubled
        ? previous.warnAt + between(WIND_WALL.double.offsetMs.min, WIND_WALL.double.offsetMs.max, random)
        : landsAt(previous) + between(WIND_WALL.gapMs.min, WIND_WALL.gapMs.max, random)
    if (previous) side = sideOf(side + 1 + Math.floor(random() * 3))
    const shooter = SHOOTERS[Math.floor(random() * SHOOTERS.length)] ?? SHOOTERS[0]
    shots.push({
      shooter: shooter.champion,
      spell: shooter.spell,
      side,
      warnAt,
      warnMs: WIND_WALL.warnMs[index] ?? 300,
      flightMs: WIND_WALL.flightMs[index] ?? 500,
    })
  }
  return shots
}

/** A wall on `side`, `ms` after the warning, as a move. */
export const wallMove = (side: Side, ms: number): number => side * SIDE_BASE + Math.min(SIDE_BASE - 1, Math.max(0, Math.round(ms)))

export interface WallAnswer {
  side: Side
  ms: number
}

/** The wall a move put up, or null if none went up in time. */
export function readWall(move: number): WallAnswer | null {
  if (move >= 4 * SIDE_BASE) return null
  return { side: sideOf(Math.floor(move / SIDE_BASE)), ms: move % SIDE_BASE }
}

export type ShotOutcome = 'blocked' | 'wrong' | 'late'

export interface ShotResult {
  outcome: ShotOutcome
  /** ms from the warning to the wall, for a block. */
  reaction: number | null
}

/** Blocked if the wall went up on the shot's side before it landed. */
export function shotResult(shot: Shot, move: number): ShotResult {
  const wall = readWall(move)
  if (!wall || wall.ms > windowMs(shot)) return { outcome: 'late', reaction: null }
  if (wall.side !== shot.side) return { outcome: 'wrong', reaction: null }
  return { outcome: 'blocked', reaction: wall.ms }
}

/** What happened to each shot a player has answered so far. */
export function shotResults(moves: Moves, volley: readonly Shot[]): ShotResult[] {
  const results: ShotResult[] = []
  for (const [index, shot] of volley.entries()) {
    const move = moves[index]
    if (move === undefined) break
    results.push(shotResult(shot, move))
  }
  return results
}

export interface WallScore {
  blocked: number
  /** All blocks' reaction times added up, in ms: the tie-break. */
  time: number
}

export function wallScore(results: readonly ShotResult[]): WallScore {
  return {
    blocked: results.filter(({ outcome }) => outcome === 'blocked').length,
    time: results.reduce((sum, { reaction }) => sum + (reaction ?? 0), 0),
  }
}

/** More blocks wins, then the faster blocks. */
export function compareWalls(a: WallScore, b: WallScore): Player | null {
  if (a.blocked !== b.blocked) return a.blocked > b.blocked ? 0 : 1
  if (a.time !== b.time) return a.time < b.time ? 0 : 1
  return null
}

/** Blocks, then speed, in one number: higher is always better. Nothing blocked is 0. */
const BLOCKS_BASE = 100_000

export function packWallScore({ blocked, time }: WallScore): number {
  if (blocked === 0) return 0
  return blocked * BLOCKS_BASE + (BLOCKS_BASE - 1 - Math.min(BLOCKS_BASE - 1, time))
}

/** "9/12 · 0.52 s": shots blocked, and the average time to get the wall up. */
export function formatWallScore(score: number): string {
  const blocked = Math.floor(score / BLOCKS_BASE)
  if (blocked === 0) return `0/${WIND_WALL.shots}`
  const time = BLOCKS_BASE - 1 - (score % BLOCKS_BASE)
  return `${blocked}/${WIND_WALL.shots} · ${(time / blocked / 1000).toFixed(2)} s`
}

/** Both players' scores once both answered every shot, otherwise null. */
export function finalWalls(moves: BothMoves, seed: number): [WallScore, WallScore] | null {
  const volley = windWallVolley(seed)
  const mine = shotResults(moves[0], volley)
  const theirs = shotResults(moves[1], volley)
  if (mine.length < volley.length || theirs.length < volley.length) return null
  return [wallScore(mine), wallScore(theirs)]
}

function settle(moves: BothMoves, { seed }: GameSetup): Settled | null {
  const scores = finalWalls(moves, seed)
  if (!scores) return null
  const [a, b] = scores
  return { winner: compareWalls(a, b), scores: [packWallScore(a), packWallScore(b)] }
}

function owed(moves: BothMoves): Owed[] {
  return ([0, 1] as const).flatMap((player) => {
    const missing = moves[player].findIndex((move) => move === undefined)
    const next = missing === -1 ? moves[player].length : missing
    return next < WIND_WALL.shots ? [{ player, step: next }] : []
  })
}

/**
 * Yone, the bot: he gets the wall up 0.42–0.76 s after the warning (a bit slower for the second
 * shot of a double) and now and then turns to the wrong side. About 8 of 12.
 */
export const BOT_WALL = { reaction: { min: 440, max: 780 }, doubleDelay: 180, wrongChance: 0.06, wrongPerShot: 0.006 } as const

export function botWall(seed: number, step: number): number | undefined {
  const volley = windWallVolley(seed)
  const shot = volley[step]
  if (!shot) return undefined
  const previous = volley[step - 1]
  const random = seededRandom(stepSeed(seed, step, 83))
  const doubled = previous !== undefined && shot.warnAt < landsAt(previous)
  const reaction = between(BOT_WALL.reaction.min, BOT_WALL.reaction.max, random) + (doubled ? BOT_WALL.doubleDelay : 0)
  if (reaction > windowMs(shot)) return NO_WALL
  const wrong = random() < BOT_WALL.wrongChance + BOT_WALL.wrongPerShot * step
  const side = wrong ? sideOf(shot.side + 1 + Math.floor(random() * 3)) : shot.side
  return wallMove(side, reaction)
}

/** When the last shot lands, in ms. */
export const volleyLengthMs = (seed: number): number => {
  const volley = windWallVolley(seed)
  const last = volley[volley.length - 1]
  return last ? landsAt(last) : 0
}

/** The longest volley possible: every gap at its longest, no doubles. */
const longestVolleyMs =
  WIND_WALL.warnMs.reduce((sum, ms) => sum + ms, 0) +
  WIND_WALL.flightMs.reduce((sum, ms) => sum + ms, 0) +
  (WIND_WALL.shots - 1) * WIND_WALL.gapMs.max

export const WIND_WALL_RULES: MiniGameRules = {
  chances: 1,
  // A 3-2-1, the volley, and a moment for the last call.
  liveSeconds: () => Math.ceil(3 + longestVolleyMs / 1000 + 3),
  owed,
  settle,
  fallback: () => NO_WALL,
  botMove: (step, _moves, { seed }) => botWall(seed, step),
  formatScore: (score) => formatWallScore(score),
  best: { of: (moves, setup) => settle(moves, setup)?.scores[0] ?? null, lowerIsBetter: false, format: formatWallScore },
}
