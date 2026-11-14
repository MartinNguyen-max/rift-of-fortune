import { useEffect, useState } from 'react'
import { isSpot, START_SPOT, type Spot } from '../../game/minigames/cleaver'
import { stepSeed, type GameSetup } from '../../game/minigames/versus'
import { seededRandom } from '../../game/random'

/** The THROW / DODGE banner at the start of a turn; the first one stays longer so nobody is caught cold. */
export const ANNOUNCE_MS = 750
export const FIRST_ANNOUNCE_MS = 1500
/** The dagger waits a moment (the dodger hops first), then flies. */
export const LAUNCH_DELAY_S = 0.15
export const FLIGHT_S = 0.55
const FLIGHT_MS = (LAUNCH_DELAY_S + FLIGHT_S) * 1000
/** The hit (or whiff) and the turn's call stay up this long. */
export const IMPACT_MS = 950

/**
 * Where a turn is on screen: the banner, your choice, waiting for the opponent, the dagger in the
 * air, the landing, and finally the end of the game.
 */
export type StageKind = 'announce' | 'choose' | 'waiting' | 'flight' | 'impact' | 'over'

export interface Stage {
  kind: StageKind
  /** The turn on screen; once over, the number of turns played. */
  turn: number
}

/** The beats a turn's timers walk through; choosing and waiting come from the moves themselves. */
type Beat = 'announce' | 'play' | 'impact'

interface Cursor {
  turn: number
  beat: Beat
}

function stageOf({ turn, beat }: Cursor, played: number, over: boolean, chosen: boolean): Stage {
  if (over && turn >= played) return { kind: 'over', turn }
  if (beat !== 'play') return { kind: beat, turn }
  if (turn < played) return { kind: 'flight', turn }
  return { kind: chosen ? 'waiting' : 'choose', turn }
}

function nextBeat(kind: StageKind, turn: number): { afterMs: number; cursor: Cursor } | null {
  if (kind === 'announce') return { afterMs: turn === 0 ? FIRST_ANNOUNCE_MS : ANNOUNCE_MS, cursor: { turn, beat: 'play' } }
  if (kind === 'flight') return { afterMs: FLIGHT_MS, cursor: { turn, beat: 'impact' } }
  if (kind === 'impact') return { afterMs: IMPACT_MS, cursor: { turn: turn + 1, beat: 'announce' } }
  return null
}

/**
 * Plays the turns one after the other, whatever order the moves arrive in.
 * `played` is the number of turns with both moves in; `chosen(turn)` tells if your move for a turn is in.
 */
export function useCleaverStage(played: number, over: boolean, chosen: (turn: number) => boolean): Stage {
  const [cursor, setCursor] = useState<Cursor>({ turn: 0, beat: 'announce' })
  const stage = stageOf(cursor, played, over, chosen(cursor.turn))
  const { kind, turn } = stage

  useEffect(() => {
    const next = nextBeat(kind, turn)
    if (!next) return
    const id = window.setTimeout(() => setCursor(next.cursor), next.afterMs)
    return () => window.clearTimeout(id)
  }, [kind, turn])

  return stage
}

/** Out of time: the dodger stays put, the thrower throws at a random spot (the same on every render). */
export function timeoutSpot(turn: number, setup: GameSetup, throwing: boolean, yourSpot: Spot): Spot {
  if (!throwing) return yourSpot
  const spot = Math.floor(seededRandom(stepSeed(setup.seed, turn, 73))() * 3)
  return isSpot(spot) ? spot : START_SPOT
}

/** The next allowed spot up (-1) or down (1) from `aim`, or `aim` at the edge. */
export function nextAllowed(allowed: readonly Spot[], aim: Spot, direction: 1 | -1): Spot {
  const ahead = allowed.filter((spot) => (direction === 1 ? spot > aim : spot < aim))
  return (direction === 1 ? ahead[0] : ahead.at(-1)) ?? aim
}

const KEY_DIRECTIONS: Partial<Record<string, 1 | -1>> = { arrowup: -1, w: -1, arrowdown: 1, s: 1 }

interface SpotKeys {
  enabled: boolean
  allowed: readonly Spot[]
  aim: Spot
  onAim: (spot: Spot) => void
  onConfirm: () => void
}

/** ↑/↓ or W/S move the aim between the allowed spots, Enter or Space confirms it. */
export function useSpotKeys({ enabled, allowed, aim, onAim, onConfirm }: SpotKeys) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      const direction = KEY_DIRECTIONS[event.key.toLowerCase()]
      if (direction !== undefined) {
        event.preventDefault()
        onAim(nextAllowed(allowed, aim, direction))
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        if (!event.repeat) onConfirm()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, allowed, aim, onAim, onConfirm])
}
