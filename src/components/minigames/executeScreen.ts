import type { CSSProperties } from 'react'
import { EXECUTE, type EnemyResult } from '../../game/minigames/execute'
import type { Moves } from '../../game/minigames/versus'
import type { Tone } from './parts'

/** The announcer by streak: kill, double kill... pentakill. */
export const STREAK_CALLS = ['KILL!', 'DOUBLE KILL!', 'TRIPLE KILL!', 'QUADRA KILL!', 'PENTAKILL!'] as const

export interface Call {
  text: string
  tone: Tone
  sub?: string
}

/** What the announcer shouts for the enemy just played (and the one before it, for a lost streak). */
export function callOf(result: EnemyResult, before: EnemyResult | undefined): Call {
  if (!result.kill) return { text: 'ESCAPED!', tone: 'lose', sub: before && before.streak >= 2 ? 'Streak over' : undefined }
  const text = STREAK_CALLS[Math.min(result.streak, STREAK_CALLS.length) - 1] ?? 'KILL!'
  return { text, tone: result.streak >= 3 ? 'win' : 'you', sub: result.reaction === null ? undefined : `${(result.reaction / 1000).toFixed(2)} s` }
}

/** Your moves: the confirmed ones, and the ones sent but not back yet. */
export const mergedMoves = (confirmed: Moves, sent: Moves): Moves =>
  Array.from({ length: Math.max(confirmed.length, sent.length) }, (_, step) => confirmed[step] ?? sent[step])

/** Where a grid spot sits in the arena, as the center point. */
export function spotPosition(spot: number): CSSProperties {
  const column = spot % EXECUTE.columns
  const row = Math.floor(spot / EXECUTE.columns)
  return { left: `${18 + column * 32}%`, top: `${20 + row * 30}%` }
}
