import { useEffect, useState } from 'react'
import { destinyHalves, gankerOf, halfScorer, type DestinyHalf } from '../../game/minigames/destiny'
import type { BothMoves, GameSetup, Player } from '../../game/minigames/versus'
import type { Tone } from './parts'

/** What the screen shows for the half being played: pick a lane to gank, or wait and guess it. */
export type DestinyPhase = 'gank' | 'ganked' | 'waitGank' | 'guess' | 'reveal'

export function destinyPhase(half: number, me: Player, moves: BothMoves, setup: GameSetup, revealing: boolean): DestinyPhase {
  if (revealing) return 'reveal'
  const ganker = gankerOf(half, setup)
  if (ganker === me) return moves[me][half] !== undefined ? 'ganked' : 'gank'
  return moves[ganker][half] === undefined ? 'waitGank' : 'guess'
}

export interface DestinyCall {
  text: string
  tone: Extract<Tone, 'win' | 'lose'>
  /** "+1 Twisted Fate" */
  sub: string
  scorer: Player
}

/** A half's result in a word, from your side: the gank got through, or it was read. */
export function destinyCall(half: DestinyHalf, me: Player, names: readonly [string, string]): DestinyCall {
  const scorer = halfScorer(half)
  const text = half.countered ? 'COUNTERED!' : half.guess === null && half.ganker !== me ? 'TOO SLOW!' : 'GANKED!'
  return { text, tone: scorer === me ? 'win' : 'lose', sub: `+1 ${names[scorer]}`, scorer }
}

/** The moments of a half's reveal: the guess shows, the ganker lands, the result is called. */
export const DESTINY_BEAT = { playing: 0, guess: 1, landed: 2, called: 3 } as const
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
      at(0, { half, beat: DESTINY_BEAT.guess }),
      at(LAND_MS, { half, beat: DESTINY_BEAT.landed }),
      at(CALL_MS, { half, beat: DESTINY_BEAT.called }),
    ]
    if (half + 1 < halves) timers.push(at(NEXT_HALF_MS, { half: half + 1, beat: DESTINY_BEAT.playing }))
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [revealing, half, halves])

  return { ...cursor, revealing }
}
