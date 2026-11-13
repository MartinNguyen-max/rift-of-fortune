import { seededRandom, type RandomFn } from '../random'
import { stepSeed, type BothMoves, type GameSetup, type MiniGameRules, type Owed, type Player, type Settled } from './versus'

export type SmiteTarget = 'baron' | 'elder'

interface Range {
  min: number
  max: number
}

/** Smite's true damage: at or below this health, a smite kills the objective. */
export const SMITE_DAMAGE = 1600

interface SmiteProfile {
  /** Health when the fight starts: the teams have been on it for a while. */
  startHp: Range
  /** The teams' damage per second; each fight picks its own. */
  dps: Range
  /** Every stretch the damage speeds up or slows down by this factor. */
  pace: Range
}

/**
 * Both teams hit the objective, so its health drops in small, uneven hits. When it falls to
 * Smite's 1,600 is impossible to time in advance; after that it takes roughly another second to
 * die. Elder is the harder fight: more damage per second, so less time to react.
 */
export const SMITE_PROFILES: Record<SmiteTarget, SmiteProfile> = {
  baron: { startHp: { min: 4200, max: 6400 }, dps: { min: 1150, max: 1500 }, pace: { min: 0.8, max: 1.25 } },
  elder: { startHp: { min: 4400, max: 6800 }, dps: { min: 1350, max: 1800 }, pace: { min: 0.8, max: 1.25 } },
}

/** Shared by both targets: how the hits come. */
export const SMITE_HITS = {
  /** Seconds between two hits: never a long pause on one value. */
  gap: { min: 0.08, max: 0.25 },
  /** Each hit is the stretch's damage times this, so hits are uneven. */
  spread: { min: 0.6, max: 1.4 },
  /** Now and then an ability or a crit: a slightly bigger hit. */
  big: { chance: 0.12, times: { min: 1.4, max: 1.8 } },
  /** No single hit takes more than this. */
  maxDamage: 450,
  /** How long the damage keeps one pace before it changes. */
  stretch: { min: 0.5, max: 1.1 },
} as const

/** Seconds at the start health before the hits start, so both players can get ready. */
export const SMITE_LEAD_IN = 0.6

/** No fight lasts longer than this (a slow one is sped up to fit). */
export const LONGEST_SMITE_FIGHT = 8

/** One hit: the health right after it, from `at` seconds on. */
export interface SmiteHit {
  at: number
  hp: number
}

/** The whole fight, decided up front from the seed, so both players see the same health. */
export interface SmiteFight {
  target: SmiteTarget
  startHp: number
  hits: SmiteHit[]
  /** When the health first drops to Smite's damage or below. */
  lineAt: number
  /** When the teams kill it; smiting from then on is too late. */
  deathAt: number
}

const between = ({ min, max }: Range, random: RandomFn) => min + random() * (max - min)

/** The hits of one fight, from the start health down to 0. */
function fightHits(profile: SmiteProfile, startHp: number, random: RandomFn): SmiteHit[] {
  const dps = between(profile.dps, random)
  const hits: SmiteHit[] = []
  let at = SMITE_LEAD_IN
  let hp = startHp
  let pace = between(profile.pace, random)
  let paceUntil = at + between(SMITE_HITS.stretch, random)
  while (hp > 0) {
    const gap = between(SMITE_HITS.gap, random)
    at += gap
    if (at >= paceUntil) {
      pace = between(profile.pace, random)
      paceUntil = at + between(SMITE_HITS.stretch, random)
    }
    const big = random() < SMITE_HITS.big.chance ? between(SMITE_HITS.big.times, random) : 1
    const damage = Math.min(SMITE_HITS.maxDamage, Math.max(20, Math.round(gap * dps * pace * between(SMITE_HITS.spread, random) * big)))
    hp = Math.max(0, hp - damage)
    hits.push({ at, hp })
  }
  return hits
}

/** A rare slow fight is sped up to fit the time limit; the hits stay the same. */
function fitInTime(hits: SmiteHit[]): SmiteHit[] {
  const end = hits[hits.length - 1]?.at ?? LONGEST_SMITE_FIGHT
  const scale = end > LONGEST_SMITE_FIGHT ? (LONGEST_SMITE_FIGHT - SMITE_LEAD_IN) / (end - SMITE_LEAD_IN) : 1
  return hits.map(({ at, hp }) => ({ at: Math.round((SMITE_LEAD_IN + (at - SMITE_LEAD_IN) * scale) * 1000) / 1000, hp }))
}

export function smiteFight(target: SmiteTarget, seed: number): SmiteFight {
  const profile = SMITE_PROFILES[target]
  const random = seededRandom(seed)
  const startHp = Math.round(between(profile.startHp, random))
  const hits = fitInTime(fightHits(profile, startHp, random))
  const line = hits.find(({ hp }) => hp <= SMITE_DAMAGE)
  const deathAt = hits[hits.length - 1]?.at ?? LONGEST_SMITE_FIGHT
  return { target, startHp, hits, lineAt: line?.at ?? deathAt, deathAt }
}

/** Health at `seconds` after the start: the health after the last hit so far. */
export function hpAt(fight: SmiteFight, seconds: number): number {
  let hp = fight.startHp
  for (const hit of fight.hits) {
    if (hit.at > seconds) break
    hp = hit.hp
  }
  return hp
}

export type SmiteOutcome = 'early' | 'late' | 'hit'

export interface SmiteResult {
  outcome: SmiteOutcome
  /** The health when the smite landed (0 if it was already dead). */
  hp: number
  /** For a smite that kills: ms after the health dropped to 1,600. */
  reaction: number | null
}

/**
 * At or below 1,600 health, Smite kills it. Above that it doesn't: too early, and that smite is
 * gone. Once the teams have killed it (or without a smite at all), it is too late.
 */
export function smiteResult(fight: SmiteFight, seconds: number | null): SmiteResult {
  if (seconds === null || seconds >= fight.deathAt) return { outcome: 'late', hp: 0, reaction: null }
  const hp = hpAt(fight, seconds)
  if (hp > SMITE_DAMAGE) return { outcome: 'early', hp, reaction: null }
  return { outcome: 'hit', hp, reaction: Math.max(0, Math.round((seconds - fight.lineAt) * 1000)) }
}

/** Who gets the objective: the first smite that kills it. Nobody, if neither does (or both at once). */
export function fightWinner(a: SmiteResult, b: SmiteResult): Player | null {
  if (a.reaction !== null && b.reaction !== null) return a.reaction === b.reaction ? null : a.reaction < b.reaction ? 0 : 1
  if (a.reaction !== null) return 0
  if (b.reaction !== null) return 1
  return null
}

// ── The mini-game: moves are smite times ─────────────────────────

/** A move for a player who never smited (in ms), later than any fight lasts. */
export const NO_SMITE = 60_000

/** Solo plays Baron, then Elder. Multiplayer plays one: Elder late in the match, otherwise Baron. */
export function smiteTargets(setup: GameSetup): SmiteTarget[] {
  if (setup.variant === 'solo') return ['baron', 'elder']
  return [setup.late ? 'elder' : 'baron']
}

/** The fight for one step of the game. */
export const fightOfStep = (setup: GameSetup, step: number): SmiteFight | null => {
  const target = smiteTargets(setup)[step]
  return target ? smiteFight(target, stepSeed(setup.seed, step, 31)) : null
}

/** A smite move (ms from the fight's start, or NO_SMITE) as a result. */
export function smiteOfMove(fight: SmiteFight, move: number): SmiteResult {
  return smiteResult(fight, move >= NO_SMITE ? null : move / 1000)
}

export type SmiteMood = 'sharp' | 'steady' | 'slow' | 'panic' | 'doze'

/**
 * Nunu smites in a different mood each fight, so there is no single answer to learn: sharp
 * reacts as fast as a pro, steady like a good player, slow sometimes loses it to the teams;
 * panic smites before the line, doze after it died. `reaction` is seconds after the line.
 */
export const BOT_SMITE: Record<SmiteMood, { chance: number; reaction: Range }> = {
  sharp: { chance: 0.2, reaction: { min: 0.19, max: 0.28 } },
  steady: { chance: 0.4, reaction: { min: 0.28, max: 0.4 } },
  slow: { chance: 0.26, reaction: { min: 0.4, max: 0.75 } },
  panic: { chance: 0.08, reaction: { min: -0.45, max: -0.1 } },
  doze: { chance: 0.06, reaction: { min: 0, max: 0 } },
}

export function smiteMood(random: RandomFn): SmiteMood {
  let roll = random()
  for (const [mood, { chance }] of Object.entries(BOT_SMITE) as [SmiteMood, { chance: number }][]) {
    if (roll < chance) return mood
    roll -= chance
  }
  return 'steady'
}

export function botSmite(fight: SmiteFight, seed: number): number {
  const random = seededRandom(seed ^ 0x3c6ef372)
  const mood = smiteMood(random)
  if (mood === 'doze') return Math.round((fight.deathAt + between({ min: 0.1, max: 0.6 }, random)) * 1000)
  return Math.max(0, Math.round((fight.lineAt + between(BOT_SMITE[mood].reaction, random)) * 1000))
}

/** Each player's smite per fight both have played so far, and who got each objective. */
export function smiteFights(moves: BothMoves, setup: GameSetup): { results: [SmiteResult, SmiteResult]; winner: Player | null }[] {
  return smiteTargets(setup).flatMap((_, step) => {
    const fight = fightOfStep(setup, step)
    const mine = moves[0][step]
    const theirs = moves[1][step]
    if (!fight || mine === undefined || theirs === undefined) return []
    const results: [SmiteResult, SmiteResult] = [smiteOfMove(fight, mine), smiteOfMove(fight, theirs)]
    return [{ results, winner: fightWinner(...results) }]
  })
}

/** How a player did over the whole game: objectives stolen, and how fast in total. */
export interface SmiteTally {
  steals: number
  /** The reactions of the steals added up, in ms: the tie-break. */
  stealMs: number
}

export function smiteTally(moves: BothMoves, setup: GameSetup): [SmiteTally, SmiteTally] {
  const tallies: [SmiteTally, SmiteTally] = [
    { steals: 0, stealMs: 0 },
    { steals: 0, stealMs: 0 },
  ]
  for (const { results, winner } of smiteFights(moves, setup)) {
    if (winner === null) continue
    tallies[winner].steals += 1
    tallies[winner].stealMs += results[winner].reaction ?? 0
  }
  return tallies
}

/** One number per player, higher is better: steals first, then the faster steals. 0 = no steal. */
const STEAL_BASE = 10_000

export function packTally({ steals, stealMs }: SmiteTally): number {
  return steals === 0 ? 0 : steals * STEAL_BASE + (STEAL_BASE - 1 - Math.min(STEAL_BASE - 1, stealMs))
}

export const stealsOfScore = (score: number): number => Math.floor(score / STEAL_BASE)
export const stealMsOfScore = (score: number): number => (score === 0 ? 0 : STEAL_BASE - 1 - (score % STEAL_BASE))

/** Keeps a number on the same line as its unit when the score wraps on a narrow screen. */
const NBSP = '\u00a0'

/** "Stolen · 312 ms" in Multiplayer; "2 steals · 640 ms" solo; "No steal". */
export function formatSmiteScore(score: number, setup: GameSetup): string {
  const steals = stealsOfScore(score)
  if (steals === 0) return 'No steal'
  const ms = `${stealMsOfScore(score)}${NBSP}ms`
  if (setup.variant === 'live') return `Stolen · ${ms}`
  return `${steals}${NBSP}${steals === 1 ? 'steal' : 'steals'} · ${ms}`
}

/** Most objectives stolen wins; a tie goes to the faster steals. Equal on both is a draw. */
function settle(moves: BothMoves, setup: GameSetup): Settled | null {
  const steps = smiteTargets(setup).length
  if (smiteFights(moves, setup).length < steps) return null
  const scores = smiteTally(moves, setup).map(packTally) as [number, number]
  const winner: Player | null = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1
  return { winner, scores }
}

/** Your fastest smite that would have killed it (stolen or not): the personal best. */
function fastestSmite(moves: BothMoves, setup: GameSetup): number | null {
  if (!settle(moves, setup)) return null
  const reactions = smiteFights(moves, setup).flatMap(({ results }) => (results[0].reaction === null ? [] : [results[0].reaction]))
  return reactions.length > 0 ? Math.min(...reactions) : null
}

function owed(moves: BothMoves, setup: GameSetup): Owed[] {
  const steps = smiteTargets(setup).length
  return ([0, 1] as const).flatMap((player) => {
    const step = moves[player].findIndex((move) => move === undefined)
    const next = step === -1 ? moves[player].length : step
    return next < steps ? [{ player, step: next }] : []
  })
}

export const SMITE_RULES: MiniGameRules = {
  chances: 1,
  // A 3-2-1, the fight, and a moment to see the result.
  liveSeconds: () => 3 + LONGEST_SMITE_FIGHT + 3,
  owed,
  settle,
  fallback: () => NO_SMITE,
  botMove: (step, _moves, setup) => {
    const fight = fightOfStep(setup, step)
    return fight ? botSmite(fight, stepSeed(setup.seed, step, 37)) : undefined
  },
  formatScore: formatSmiteScore,
  best: { of: fastestSmite, lowerIsBetter: true, format: (ms) => `${ms} ms` },
}
