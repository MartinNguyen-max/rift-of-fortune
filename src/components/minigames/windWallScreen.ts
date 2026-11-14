import type { ShotResult, Side } from '../../game/minigames/windwall'
import type { Moves } from '../../game/minigames/versus'
import type { Tone } from './parts'

/** Points in the arena, in % of its size: the middle (Yasuo) and where each side's shooter stands. */
export const CENTER = { x: 50, y: 50 } as const
const EDGE = 42

/** Where a side's shooter stands, clockwise from the top. */
export function edgePoint(side: Side): { x: number; y: number } {
  const [dx, dy] = ([[0, -1], [1, 0], [0, 1], [-1, 0]] as const)[side]
  return { x: CENTER.x + dx * EDGE, y: CENTER.y + dy * EDGE }
}

/** The shot meets the wall this far along its path from the shooter to Yasuo. */
export const WALL_AT = 0.62

/** A point `share` of the way from a side's shooter to Yasuo. */
export function alongPath(side: Side, share: number): { x: number; y: number } {
  const edge = edgePoint(side)
  return { x: edge.x + (CENTER.x - edge.x) * share, y: edge.y + (CENTER.y - edge.y) * share }
}

/** The side a tap at (x, y) points to, measured from the middle of the arena (any units). */
export function sideFromPoint(x: number, y: number): Side {
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 1 : 3
  return y > 0 ? 2 : 0
}

/** Arrow keys and WASD, clockwise from up. */
const KEY_SIDES: Readonly<Record<string, Side>> = {
  ArrowUp: 0,
  KeyW: 0,
  ArrowRight: 1,
  KeyD: 1,
  ArrowDown: 2,
  KeyS: 2,
  ArrowLeft: 3,
  KeyA: 3,
}

export const sideOfKey = (code: string): Side | null => KEY_SIDES[code] ?? null

export interface Call {
  text: string
  tone: Tone
  sub?: string
}

/** What the announcer shouts for the shot just answered. */
export function wallCall(result: ShotResult): Call {
  if (result.outcome === 'blocked') return { text: 'BLOCKED!', tone: 'you', sub: result.reaction === null ? undefined : `${(result.reaction / 1000).toFixed(2)} s` }
  if (result.outcome === 'wrong') return { text: 'WRONG SIDE!', tone: 'lose' }
  return { text: 'HIT!', tone: 'lose', sub: 'Too slow' }
}

/** Your moves: the confirmed ones, and the ones sent but not back yet. */
export const mergedMoves = (confirmed: Moves, sent: Moves): Moves =>
  Array.from({ length: Math.max(confirmed.length, sent.length) }, (_, step) => confirmed[step] ?? sent[step])
