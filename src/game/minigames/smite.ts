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
  /** How often the last stretch before it dies is a burst (much faster), so waiting is a gamble. */
  burst: { chance: number; pace: Range }
}

/**
 * The health drains smoothly but changes pace sharply from stretch to stretch, so nobody can
 * learn the timing. Smite range comes around the middle of the duel. Sometimes the last stretch
 * is a burst, so waiting for very low health is a risk. Elder is the harder duel: less time in
 * range and wilder pace changes.
 */
export const SMITE_PROFILES: Record<SmiteTarget, SmiteProfile> = {
  baron: {
    maxHp: 12000,
    smiteDamage: 1200,
    toRange: { min: 3.4, max: 4.6 },
    inRange: { min: 2.8, max: 4.2 },
    stretches: { toRange: 3, inRange: 4 },
    pace: { slow: { min: 0.2, max: 0.6 }, fast: { min: 1.6, max: 2.6 } },
    burst: { chance: 0.4, pace: { min: 3, max: 4.5 } },
  },
  elder: {
    maxHp: 15000,
    smiteDamage: 1200,
    toRange: { min: 3, max: 4.2 },
    inRange: { min: 2.5, max: 3.6 },
    stretches: { toRange: 3, inRange: 5 },
    pace: { slow: { min: 0.15, max: 0.5 }, fast: { min: 1.8, max: 3 } },
    burst: { chance: 0.5, pace: { min: 3.5, max: 5 } },
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

/**
 * Splits `drop` health over `seconds` into stretches of random length, each slow or fast. With
 * `burst`, the last stretch drains at that pace instead.
 */
function stretches(
  start: SmitePoint,
  drop: number,
  seconds: number,
  count: number,
  pace: SmiteProfile['pace'],
  random: RandomFn,
  burst: Range | null = null,
): SmitePoint[] {
  const lengths = Array.from({ length: count }, () => 0.6 + random() * 0.8)
  const totalLength = lengths.reduce((sum, length) => sum + length, 0)
  const durations = lengths.map((length) => (length / totalLength) * seconds)
  // A burst takes the last stretch; the others still have at least one slow and one fast.
  const kinds = paceKinds(burst ? count - 1 : count, random)
  const paceOf = (index: number) => (burst && index === count - 1 ? burst : kinds[index] ? pace.fast : pace.slow)
  const drains = durations.map((duration, index) => duration * between(paceOf(index), random))
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
  const burst = random() < profile.burst.chance ? profile.burst.pace : null
  const inRange = stretches(rangeStart, threshold, between(profile.inRange, random), profile.stretches.inRange, profile.pace, random, burst)
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

/** The first moment the health is down to `hp` (0–1). The health only goes down, so there is one. */
export function timeAtHp(duel: SmiteDuel, hp: number): number {
  const { points } = duel
  for (let index = 1; index < points.length; index++) {
    const before = points[index - 1]
    const after = points[index]
    if (!before || !after || after.hp > hp) continue
    const share = before.hp === after.hp ? 0 : (before.hp - hp) / (before.hp - after.hp)
    return before.at + (after.at - before.at) * Math.min(1, Math.max(0, share))
  }
  return duel.deathAt
}

export type SmiteMood = 'safe' | 'steady' | 'greedy' | 'panic' | 'doze'

/**
 * How the enemy smites: a different mood each duel, so there is no single answer to learn.
 * Each mood waits for the health to drop to a share of smite range (`hp`, like a player watching
 * the number), then reacts a little late. Greedy waits for very low health and sometimes loses
 * it to a burst; panic smites before the health is in range; doze smites after it died.
 */
export const BOT_SMITE: { reaction: Range; moods: Record<SmiteMood, { chance: number; hp: Range }> } = {
  reaction: { min: 0.06, max: 0.22 },
  moods: {
    safe: { chance: 0.22, hp: { min: 0.5, max: 0.9 } },
    steady: { chance: 0.3, hp: { min: 0.22, max: 0.55 } },
    greedy: { chance: 0.38, hp: { min: 0.04, max: 0.2 } },
    panic: { chance: 0.04, hp: { min: 1.15, max: 1.6 } },
    doze: { chance: 0.06, hp: { min: 0, max: 0 } },
  },
}

export function smiteMood(random: RandomFn): SmiteMood {
  let roll = random()
  for (const [mood, { chance }] of Object.entries(BOT_SMITE.moods) as [SmiteMood, { chance: number }][]) {
    if (roll < chance) return mood
    roll -= chance
  }
  return 'steady'
}

export function botSmite(duel: SmiteDuel, seed: number): number {
  const random = seededRandom(seed ^ 0x3c6ef372)
  const mood = smiteMood(random)
  if (mood === 'doze') return Math.round((duel.deathAt + between({ min: 0.1, max: 0.6 }, random)) * 1000)
  const hp = Math.min(1, between(BOT_SMITE.moods[mood].hp, random) * duel.threshold)
  return Math.round((timeAtHp(duel, hp) + between(BOT_SMITE.reaction, random)) * 1000)
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
