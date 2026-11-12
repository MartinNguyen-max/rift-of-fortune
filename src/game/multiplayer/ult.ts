import { seededRandom } from '../random'

/**
 * The teamfight ult: a marker sweeps back and forth over a bar, a little faster each second.
 * Stop it as close to the middle of the zone as you can. `seconds` is the time limit.
 */
export const ULT = {
  seconds: 9,
  /** Bar lengths per second at the start, and how much faster it gets each second. */
  speed: { min: 0.55, max: 0.75 },
  acceleration: 0.15,
  /** Where the marker starts, so it is never stuck at the very edge. */
  start: 0.08,
} as const

/**
 * Score bands around the zone's middle, as half-widths (share of the bar), shown on the bar.
 * Inside `perfect` scores 100; from there the score drops smoothly to `min.score` at `min.distance`.
 * Any press scores at least `min.score`, so a duel is rarely decided at 0–0.
 */
export const ULT_ZONES = {
  perfect: 0.03,
  great: 0.08,
  good: 0.15,
  min: { distance: 0.48, score: 10 },
} as const

export interface UltBar {
  /** Middle of the zone, 0–1 along the bar. */
  zoneCenter: number
  speed: number
}

export function ultBar(seed: number): UltBar {
  const random = seededRandom(seed)
  const zoneCenter = 0.3 + random() * 0.4
  const speed = ULT.speed.min + random() * (ULT.speed.max - ULT.speed.min)
  return { zoneCenter, speed }
}

/** The marker's position (0–1) at `seconds`: it starts near the left and bounces off both ends. */
export function markerAt(bar: UltBar, seconds: number): number {
  const distance = ULT.start + bar.speed * seconds + (ULT.acceleration * bar.speed * seconds * seconds) / 2
  const lap = distance % 2
  return lap <= 1 ? lap : 2 - lap
}

/** 100 in the perfect band, then smoothly less the further off; 0 only without a press in time. */
export function ultScore(bar: UltBar, seconds: number | null): number {
  if (seconds === null || seconds > ULT.seconds) return 0
  const distance = Math.abs(markerAt(bar, seconds) - bar.zoneCenter)
  if (distance <= ULT_ZONES.perfect) return 100
  const { min } = ULT_ZONES
  const share = (distance - ULT_ZONES.perfect) / (min.distance - ULT_ZONES.perfect)
  return Math.max(min.score, Math.round(100 - share * (100 - min.score)))
}
