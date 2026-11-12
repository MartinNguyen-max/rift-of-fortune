import { seededRandom, type RandomFn } from '../random'

export type SmiteTarget = 'baron' | 'elder'

interface Range {
  min: number
  max: number
}

interface SmiteProfile {
  /** Shown health, like the real objective. */
  maxHp: number
  smiteDamage: number
  /** Seconds between hits while the health is above smite range. */
  gap: Range
  /** Share of max health each of those hits takes. */
  drop: Range
  /** Seconds between hits once the health is in smite range: the window to smite. */
  windowGap: Range
  /** Share of the smite damage each hit in smite range takes. */
  windowDrop: Range
}

/** Elder has less health in smite range and gets hit faster: the harder duel. */
export const SMITE_PROFILES: Record<SmiteTarget, SmiteProfile> = {
  baron: {
    maxHp: 12000,
    smiteDamage: 1200,
    gap: { min: 0.18, max: 0.45 },
    drop: { min: 0.03, max: 0.08 },
    windowGap: { min: 0.3, max: 0.65 },
    windowDrop: { min: 0.2, max: 0.45 },
  },
  elder: {
    maxHp: 15000,
    smiteDamage: 1200,
    gap: { min: 0.15, max: 0.4 },
    drop: { min: 0.025, max: 0.07 },
    windowGap: { min: 0.22, max: 0.5 },
    windowDrop: { min: 0.22, max: 0.5 },
  },
}

/** Seconds of full health before the first hit, so both players can get ready. */
export const SMITE_LEAD_IN = 0.8

/** The score for smiting the moment the health enters smite range; a smite at 1 health is 100. */
export const SMITE_SCORE = { inRange: 50, perfect: 100 } as const

export interface SmiteHit {
  /** Seconds after the duel starts. */
  at: number
  /** Health left after the hit, 0–1. */
  hp: number
}

/** The whole duel, decided up front from the seed, so both players see the same hits. */
export interface SmiteDuel {
  target: SmiteTarget
  hits: SmiteHit[]
  /** Smite range as a share of max health. */
  threshold: number
  /** When the last hit kills the objective; smiting after this is too late. */
  deathAt: number
}

const between = ({ min, max }: Range, random: RandomFn) => min + random() * (max - min)

export function smiteDuel(target: SmiteTarget, seed: number): SmiteDuel {
  const profile = SMITE_PROFILES[target]
  const random = seededRandom(seed)
  const threshold = profile.smiteDamage / profile.maxHp
  const hits: SmiteHit[] = []
  let hp = 1
  let at = SMITE_LEAD_IN

  while (hp > threshold) {
    at += between(profile.gap, random)
    const next = hp - between(profile.drop, random)
    // The hit into smite range always leaves a bit of room, so there is a window to smite in.
    hp = next > threshold ? next : threshold * (0.6 + random() * 0.35)
    hits.push({ at, hp })
  }
  while (hp > 0) {
    at += between(profile.windowGap, random)
    hp = Math.max(0, hp - threshold * between(profile.windowDrop, random))
    hits.push({ at, hp })
  }
  return { target, hits, threshold, deathAt: at }
}

/** Health (0–1) at `seconds` after the start. */
export function hpAt(duel: SmiteDuel, seconds: number): number {
  return duel.hits.findLast(({ at }) => at <= seconds)?.hp ?? 1
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
