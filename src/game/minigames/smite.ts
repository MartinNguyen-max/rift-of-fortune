import { seededRandom, type RandomFn } from '../random'
import { stepSeed, type BothMoves, type GameSetup, type MiniGameRules, type Owed, type Player, type Settled } from './versus'

export type SmiteTarget = 'baron' | 'elder'

interface Range {
  min: number
  max: number
}

interface SmiteProfile {
  /** Shown health, like the real objective. */
  maxHp: number
  smiteDamage: number
  /** Seconds from the first damage until the health is in smite range. */
  toRange: Range
  /** Seconds the health spends in smite range before the objective dies. */
  inRange: Range
  /** How many stretches of steady pace each part has. Each stretch drains at its own speed. */
  stretches: { toRange: number; inRange: number }
  /** Paces of slow and fast stretches. Each part has at least one of each. */
  pace: { slow: Range; fast: Range }
}

/**
 * The health drains smoothly but changes pace from stretch to stretch, so nobody can learn the
 * timing. Smite range comes around the middle of the duel. Elder is the harder duel: less time
 * in range and wilder pace changes.
 */
export const SMITE_PROFILES: Record<SmiteTarget, SmiteProfile> = {
  baron: {
    maxHp: 12000,
    smiteDamage: 1200,
    toRange: { min: 3.4, max: 4.6 },
    inRange: { min: 3.4, max: 5 },
    stretches: { toRange: 3, inRange: 4 },
    pace: { slow: { min: 0.3, max: 0.7 }, fast: { min: 1.5, max: 2.2 } },
  },
  elder: {
    maxHp: 15000,
    smiteDamage: 1200,
    toRange: { min: 3, max: 4.2 },
    inRange: { min: 2.8, max: 4.2 },
    stretches: { toRange: 3, inRange: 5 },
    pace: { slow: { min: 0.25, max: 0.6 }, fast: { min: 1.6, max: 2.8 } },
  },
}

/** Seconds of full health before the damage starts, so both players can get ready. */
export const SMITE_LEAD_IN = 1

/** The score for smiting the moment the health enters smite range; a smite at 1 health is 100. */
export const SMITE_SCORE = { inRange: 50, perfect: 100 } as const

/** A corner of the health line: the health (0–1) at `at` seconds. The health is a straight line in between. */
export interface SmitePoint {
  at: number
  hp: number
}

/** The whole duel, decided up front from the seed, so both players see the same health. */
export interface SmiteDuel {
  target: SmiteTarget
  points: SmitePoint[]
  /** Smite range as a share of max health. */
  threshold: number
  /** When the health enters smite range. */
  rangeAt: number
  /** When the objective dies; smiting after this is too late. */
  deathAt: number
}

const between = ({ min, max }: Range, random: RandomFn) => min + random() * (max - min)

/** Slow or fast for each stretch, at random, but never all the same. */
function paceKinds(count: number, random: RandomFn): boolean[] {
  const fast = Array.from({ length: count }, () => random() < 0.5)
  if (fast.every((kind) => kind === fast[0])) {
    const flip = Math.floor(random() * count)
    fast[flip] = !fast[flip]
  }
  return fast
}

/** Splits `drop` health over `seconds` into stretches of random length, each slow or fast. */
function stretches(
  start: SmitePoint,
  drop: number,
  seconds: number,
  count: number,
  pace: SmiteProfile['pace'],
  random: RandomFn,
): SmitePoint[] {
  const lengths = Array.from({ length: count }, () => 0.6 + random() * 0.8)
  const totalLength = lengths.reduce((sum, length) => sum + length, 0)
  const durations = lengths.map((length) => (length / totalLength) * seconds)
  const kinds = paceKinds(count, random)
  const drains = durations.map((duration, index) => duration * between(kinds[index] ? pace.fast : pace.slow, random))
  const totalDrain = drains.reduce((sum, drain) => sum + drain, 0)

  const points: SmitePoint[] = []
  let { at, hp } = start
  durations.forEach((duration, index) => {
    at += duration
    hp -= ((drains[index] ?? 0) / totalDrain) * drop
    points.push({ at, hp })
  })
  // Rounding never leaves the end of a part a hair off.
  const last = points[points.length - 1]
  if (last) last.hp = start.hp - drop
  return points
}

export function smiteDuel(target: SmiteTarget, seed: number): SmiteDuel {
  const profile = SMITE_PROFILES[target]
  const random = seededRandom(seed)
  const threshold = profile.smiteDamage / profile.maxHp
  const start: SmitePoint = { at: SMITE_LEAD_IN, hp: 1 }
  const toRange = stretches(start, 1 - threshold, between(profile.toRange, random), profile.stretches.toRange, profile.pace, random)
  const rangeStart = toRange[toRange.length - 1] ?? start
  const inRange = stretches(rangeStart, threshold, between(profile.inRange, random), profile.stretches.inRange, profile.pace, random)
  const points = [start, ...toRange, ...inRange]
  return { target, points, threshold, rangeAt: rangeStart.at, deathAt: points[points.length - 1]?.at ?? rangeStart.at }
}

/** Health (0–1) at `seconds` after the start. */
export function hpAt(duel: SmiteDuel, seconds: number): number {
  const { points } = duel
  const next = points.findIndex(({ at }) => at > seconds)
  if (next === -1) return 0
  const after = points[next]
  const before = points[next - 1]
  if (!after || !before) return 1
  const share = (seconds - before.at) / (after.at - before.at)
  return before.hp + (after.hp - before.hp) * share
}

export type SmiteOutcome = 'early' | 'late' | 'hit'

export interface SmiteResult {
  outcome: SmiteOutcome
  score: number
  /** The health the smite landed on, in shown health points. */
  hp: number
}

/**
 * Smiting in range scores 50–100: the lower the health, the higher the score, but wait too long
 * and the objective dies first. Smiting too early or too late (or not at all) scores 0.
 */
export function smiteResult(duel: SmiteDuel, seconds: number | null): SmiteResult {
  const { maxHp } = SMITE_PROFILES[duel.target]
  if (seconds === null || seconds >= duel.deathAt) return { outcome: 'late', score: 0, hp: 0 }
  const hp = hpAt(duel, seconds)
  const shownHp = Math.max(1, Math.round(hp * maxHp))
  if (hp > duel.threshold) return { outcome: 'early', score: 0, hp: shownHp }
  const { inRange, perfect } = SMITE_SCORE
  const score = Math.round(inRange + (perfect - inRange) * (1 - hp / duel.threshold))
  return { outcome: 'hit', score, hp: shownHp }
}

// ── The mini-game: moves are smite times ─────────────────────────

/** A move for a player who never smited (in ms), later than any duel lasts. */
export const NO_SMITE = 60_000

/** Solo plays Baron, then Elder. Multiplayer plays one: Elder late in the match, otherwise Baron. */
export function smiteTargets(setup: GameSetup): SmiteTarget[] {
  if (setup.variant === 'solo') return ['baron', 'elder']
  return [setup.late ? 'elder' : 'baron']
}

/** The duel for one step of the game. */
export const duelOfStep = (setup: GameSetup, step: number): SmiteDuel | null => {
  const target = smiteTargets(setup)[step]
  return target ? smiteDuel(target, stepSeed(setup.seed, step, 31)) : null
}

/** A smite move (ms from the duel start, or NO_SMITE) as a result. */
export function smiteOfMove(duel: SmiteDuel, move: number): SmiteResult {
  return smiteResult(duel, move >= NO_SMITE ? null : move / 1000)
}

/** How the bot plays: it smites somewhere in the first half or so of smite range, and now and then dozes off. */
export const BOT_SMITE = { from: 0.3, to: 0.82, dozeChance: 0.1 } as const

export function botSmite(duel: SmiteDuel, seed: number): number {
  const random = seededRandom(seed ^ 0x3c6ef372)
  const window = duel.deathAt - duel.rangeAt
  if (random() < BOT_SMITE.dozeChance) return Math.round((duel.deathAt + 0.2) * 1000)
  return Math.round((duel.rangeAt + window * between({ min: BOT_SMITE.from, max: BOT_SMITE.to }, random)) * 1000)
}

/** Each player's score per duel played so far. */
export function smiteScores(moves: BothMoves, setup: GameSetup): [number[], number[]] {
  const scores: [number[], number[]] = [[], []]
  smiteTargets(setup).forEach((_, step) => {
    const duel = duelOfStep(setup, step)
    for (const player of [0, 1] as const) {
      const move = moves[player][step]
      if (duel && move !== undefined) scores[player].push(smiteOfMove(duel, move).score)
    }
  })
  return scores
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)

function settle(moves: BothMoves, setup: GameSetup): Settled | null {
  const steps = smiteTargets(setup).length
  const [mine, theirs] = smiteScores(moves, setup)
  if (mine.length < steps || theirs.length < steps) return null
  const scores: [number, number] = [sum(mine), sum(theirs)]
  const winner: Player | null = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1
  return { winner, scores }
}

function owed(moves: BothMoves, setup: GameSetup): Owed[] {
  const steps = smiteTargets(setup).length
  return ([0, 1] as const).flatMap((player) => {
    const step = moves[player].findIndex((move) => move === undefined)
    const next = step === -1 ? moves[player].length : step
    return next < steps ? [{ player, step: next }] : []
  })
}

/** The longest a duel can last, in seconds. */
export const LONGEST_SMITE_DUEL =
  SMITE_LEAD_IN + Math.max(...Object.values(SMITE_PROFILES).map(({ toRange, inRange }) => toRange.max + inRange.max))

export const SMITE_RULES: MiniGameRules = {
  chances: 1,
  // A 3-2-1, the duel, and a moment to see the result.
  liveSeconds: () => 3 + LONGEST_SMITE_DUEL + 3,
  owed,
  settle,
  fallback: () => NO_SMITE,
  botMove: (step, _moves, setup) => {
    const duel = duelOfStep(setup, step)
    return duel ? botSmite(duel, stepSeed(setup.seed, step, 37)) : undefined
  },
  formatScore: (score) => `${score} pts`,
  best: { of: (moves, setup) => settle(moves, setup)?.scores[0] ?? null, lowerIsBetter: false, format: (score) => `${score} pts` },
}
