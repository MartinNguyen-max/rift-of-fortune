import { useEffect, useState } from 'react'
import { destinyHalves, gankerOf, halfPoints, halfScorer, type DestinyHalf } from '../../game/minigames/destiny'
import type { BothMoves, GameSetup, Player } from '../../game/minigames/versus'
import type { Tone } from './parts'

/** What the screen shows for the half being played: pick a lane to gank, or wait and guess it. */
export type DestinyPhase = 'gank' | 'ganked' | 'waitGank' | 'guess' | 'reveal'

export function destinyPhase(half: number, me: Player, moves: BothMoves, setup: GameSetup, revealing: boolean): DestinyPhase {
  if (revealing) return 'reveal'
  const ganker = gankerOf(setup)
  if (ganker === me) return moves[me][half] !== undefined ? 'ganked' : 'gank'
  return moves[ganker][half] === undefined ? 'waitGank' : 'guess'
}

export interface DestinyCall {
  text: string
  tone: Extract<Tone, 'win' | 'lose'>
  /** "+2 Nocturne" */
  sub: string
  scorer: Player
}

/** A game's words: Global Gank ganks, I Was Hiding hides. */
export interface LaneGuessWords {
  pick: string
  picked: (lane: string) => string
  waiting: (name: string) => string
  guess: string
  /** The call when the pick wasn't guessed ("GANKED!"), and when it was ("COUNTERED!"). */
  through: string
  found: string
}

/** A half's result in a word, from your side: the pick got through, or it was read. */
export function destinyCall(half: DestinyHalf, me: Player, names: readonly [string, string], words: Pick<LaneGuessWords, 'through' | 'found'>): DestinyCall {
  const scorer = halfScorer(half)
  const text = half.countered ? words.found : half.guess === null && half.ganker !== me ? 'TOO SLOW!' : words.through
  return { text, tone: scorer === me ? 'win' : 'lose', sub: `+${halfPoints(half)} ${names[scorer]}`, scorer }
}

/** The moments of a half's reveal: the guess shows, the ganker lands, the result is called. */
export const DESTINY_BEAT = { playing: 0, guess: 1, landed: 2, called: 3 } as const
export type DestinyBeat = (typeof DESTINY_BEAT)[keyof typeof DESTINY_BEAT]

const LAND_MS = 550
const CALL_MS = 1050
const NEXT_HALF_MS = 3000

export interface DestinyCursor {
  half: number
  beat: DestinyBeat
  revealing: boolean
}

/** Walks through each finished half's reveal, one at a time, then moves on. Stays on the last one. */
export function useDestinyReveal(finished: number): DestinyCursor {
  const [cursor, setCursor] = useState<{ half: number; beat: DestinyBeat }>({ half: 0, beat: DESTINY_BEAT.playing })
  const { half } = cursor
  const revealing = half < finished
  const halves = destinyHalves()

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
