import { seededRandom } from '../random'

/**
 * The teamfight ult: a marker races back and forth over a bar, faster and faster. Stop it in the
 * zone. `seconds` is the time limit; not pressing scores 0.
 */
export const ULT = {
  seconds: 6,
  /** Half the zone's width, as a share of the bar. */
  zoneHalfWidth: 0.08,
  /** Bar lengths per second at the start, and how much faster it gets each second. */
  speed: { min: 0.9, max: 1.2 },
  acceleration: 0.35,
} as const

/** Scores: 60–100 inside the zone (100 dead center), then quickly down to 0 outside it. */
export const ULT_SCORE = { zoneEdge: 60, outsideStart: 50, outsideFalloff: 200 } as const

export interface UltBar {
  /** Middle of the zone, 0–1 along the bar. */
  zoneCenter: number
  speed: number
}

export function ultBar(seed: number): UltBar {
  const random = seededRandom(seed)
  const zoneCenter = 0.25 + random() * 0.5
  const speed = ULT.speed.min + random() * (ULT.speed.max - ULT.speed.min)
  return { zoneCenter, speed }
}

/** The marker's position (0–1) at `seconds`: it starts left and bounces off both ends. */
export function markerAt(bar: UltBar, seconds: number): number {
  const distance = bar.speed * seconds + (ULT.acceleration * bar.speed * seconds * seconds) / 2
  const lap = distance % 2
  return lap <= 1 ? lap : 2 - lap
}

export function ultScore(bar: UltBar, seconds: number | null): number {
  if (seconds === null || seconds > ULT.seconds) return 0
  const distance = Math.abs(markerAt(bar, seconds) - bar.zoneCenter)
  const { zoneEdge, outsideStart, outsideFalloff } = ULT_SCORE
  if (distance <= ULT.zoneHalfWidth) return Math.round(100 - (100 - zoneEdge) * (distance / ULT.zoneHalfWidth))
  return Math.max(0, Math.round(outsideStart - (distance - ULT.zoneHalfWidth) * outsideFalloff))
}
