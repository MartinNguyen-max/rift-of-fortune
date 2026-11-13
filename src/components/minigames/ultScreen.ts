import { markerAt, NO_PRESS, ULT_ZONES, ultScoreOfMove, type UltBar } from '../../game/minigames/ult'
import type { Tone } from './parts'

/** Where a press stopped the marker (0–1), or null if there was no press in time. */
export const pressMarker = (bar: UltBar, move: number): number | null =>
  move >= NO_PRESS ? null : markerAt(bar, move / 1000)

export type UltBand = 'perfect' | 'great' | 'good' | 'wide' | 'missed'

/** Which of the bands drawn on the bar a press landed in. */
export function ultBand(bar: UltBar, move: number): UltBand {
  const position = pressMarker(bar, move)
  if (position === null || ultScoreOfMove(bar, move) === 0) return 'missed'
  const distance = Math.abs(position - bar.zoneCenter)
  if (distance <= ULT_ZONES.perfect) return 'perfect'
  if (distance <= ULT_ZONES.great) return 'great'
  if (distance <= ULT_ZONES.good) return 'good'
  return 'wide'
}

export const ULT_CALLS: Record<UltBand, { text: string; tone: Tone }> = {
  perfect: { text: 'PERFECT!', tone: 'win' },
  great: { text: 'GREAT!', tone: 'win' },
  good: { text: 'GOOD', tone: 'you' },
  wide: { text: 'WIDE', tone: 'plain' },
  missed: { text: 'TOO SLOW!', tone: 'lose' },
}
