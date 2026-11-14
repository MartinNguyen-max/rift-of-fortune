import { useEffect, useState } from 'react'
import { destinyHalves, gaterOf, halfScore, type DestinyHalf } from '../../game/minigames/destiny'
import type { BothMoves, GameSetup, Player } from '../../game/minigames/versus'
import type { Tone } from './parts'

/**
 * What the screen shows for the half being played. As Twisted Fate: pick the card's lane, then
 * the Gate's lane, then wait. As the guard: wait for the card, then guard a lane.
 */
export type DestinyPhase = 'card' | 'gate' | 'gated' | 'waitCard' | 'guard' | 'reveal'

export function destinyPhase(half: number, me: Player, moves: BothMoves, setup: GameSetup, revealing: boolean, cardPicked: boolean): DestinyPhase {
  if (revealing) return 'reveal'
  const gater = gaterOf(half, setup)
  if (gater === me) return moves[me][half] !== undefined ? 'gated' : cardPicked ? 'gate' : 'card'
  return moves[gater][half] === undefined ? 'waitCard' : 'guard'
}

export interface DestinyCall {
  text: string
  tone: Extract<Tone, 'win' | 'lose'>
  /** "+2 Twisted Fate" */
  sub: string
  scorer: Player
}

/** A half's result in a word, from your side. */
export function destinyCall(half: DestinyHalf, me: Player, names: readonly [string, string]): DestinyCall {
  const { scorer, points } = halfScore(half)
  const mine = scorer === me
  const youGated = half.gater === me
  const text = half.guarded
    ? youGated
      ? 'GUARDED!'
      : 'CAUGHT!'
    : half.honest
      ? youGated
        ? 'GOLD CARD!'
        : 'THE TRUTH!'
      : youGated
        ? 'BLUFFED!'
        : half.guard === null
          ? 'TOO SLOW!'
          : 'BLUFFED!'
  return { text, tone: mine ? 'win' : 'lose', sub: `+${points} ${names[scorer]}`, scorer }
}

/** The moments of a half's reveal: the guard shows, Twisted Fate lands, the result is called. */
export const DESTINY_BEAT = { playing: 0, guard: 1, landed: 2, called: 3 } as const
export type DestinyBeat = (typeof DESTINY_BEAT)[keyof typeof DESTINY_BEAT]

const LAND_MS = 650
const CALL_MS = 1250
const NEXT_HALF_MS = 3600

export interface DestinyCursor {
  half: number
  beat: DestinyBeat
  revealing: boolean
}

/** Walks through each finished half's reveal, one at a time, then moves on. Stays on the last one. */
export function useDestinyReveal(finished: number, setup: GameSetup): DestinyCursor {
  const [cursor, setCursor] = useState<{ half: number; beat: DestinyBeat }>({ half: 0, beat: DESTINY_BEAT.playing })
  const { half } = cursor
  const revealing = half < finished
  const halves = destinyHalves(setup)

  useEffect(() => {
    if (!revealing) return
    const at = (ms: number, next: { half: number; beat: DestinyBeat }) => window.setTimeout(() => setCursor(next), ms)
    const timers = [
      at(0, { half, beat: DESTINY_BEAT.guard }),
      at(LAND_MS, { half, beat: DESTINY_BEAT.landed }),
      at(CALL_MS, { half, beat: DESTINY_BEAT.called }),
    ]
    if (half + 1 < halves) timers.push(at(NEXT_HALF_MS, { half: half + 1, beat: DESTINY_BEAT.playing }))
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [revealing, half, halves])

  return { ...cursor, revealing }
}
