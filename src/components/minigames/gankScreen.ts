import { useEffect, useState } from 'react'
import { gankHalves, hiderOf, isBush, type Bush, type GankHalf } from '../../game/minigames/gank'
import { other, type BothMoves, type GameSetup, type Player } from '../../game/minigames/versus'
import type { Tone } from './parts'

/** What the screen shows for the half being played. */
export type GankPhase = 'hide' | 'hidden' | 'waitHide' | 'guess' | 'reveal'

export function gankPhase(half: number, me: Player, moves: BothMoves, setup: GameSetup, revealing: boolean): GankPhase {
  if (revealing) return 'reveal'
  const hider = hiderOf(half, setup)
  if (hider === me) return moves[me][half] === undefined ? 'hide' : 'hidden'
  return moves[hider][half] === undefined ? 'waitHide' : 'guess'
}

/** A hiding move as a bush; the rules put anything else in the middle bush. */
export const bushOf = (move: number | undefined): Bush => (move !== undefined && isBush(move) ? move : 1)

/** Who got the point for a half. */
export const scorerOf = ({ hider, found }: GankHalf): Player => (found ? other(hider) : hider)

export interface HalfCall {
  text: string
  /** Gold when the point is yours, red when it is theirs. */
  tone: Extract<Tone, 'win' | 'lose'>
  scorer: Player
}

/** The half's result in one word, from your side: FOUND! or MISSED! when you guessed, SAFE! or CAUGHT! when you hid. */
export function halfCall(half: GankHalf, me: Player): HalfCall {
  const scorer = scorerOf(half)
  const text =
    half.hider === me ? (half.found ? 'CAUGHT!' : 'SAFE!') : half.found ? 'FOUND!' : half.guess === null ? 'TOO SLOW!' : 'MISSED!'
  return { text, tone: scorer === me ? 'win' : 'lose', scorer }
}

/** The moments of a half's reveal: the guess lands, the hider pops out, the result is called. */
export const BEAT = { playing: 0, guessed: 1, popped: 2, called: 3 } as const
export type Beat = (typeof BEAT)[keyof typeof BEAT]

/** When you hid, your champion's jump into the bush plays before their guess lands. */
const SINK_MS = 700
/** After the guess lands, in ms. */
const POP_MS = 700
const CALL_MS = 1050
const NEXT_HALF_MS = 3300

export interface RevealCursor {
  /** The half on screen: being played, or being revealed. */
  half: number
  beat: Beat
  /** The half on screen is finished and its reveal is playing. */
  revealing: boolean
}

/**
 * Walks through each finished half's reveal, one at a time, then moves on to the next half.
 * Stays on the last half once it is called.
 */
export function useRevealCursor(finished: number, setup: GameSetup, me: Player): RevealCursor {
  const [cursor, setCursor] = useState<{ half: number; beat: Beat }>({ half: 0, beat: BEAT.playing })
  const { half } = cursor
  const revealing = half < finished
  const halves = gankHalves(setup)
  const lead = hiderOf(half, setup) === me ? SINK_MS : 0

  useEffect(() => {
    if (!revealing) return
    const at = (ms: number, next: { half: number; beat: Beat }) => window.setTimeout(() => setCursor(next), lead + ms)
    const timers = [
      at(0, { half, beat: BEAT.guessed }),
      at(POP_MS, { half, beat: BEAT.popped }),
      at(CALL_MS, { half, beat: BEAT.called }),
    ]
    if (half + 1 < halves) timers.push(at(NEXT_HALF_MS, { half: half + 1, beat: BEAT.playing }))
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [revealing, half, halves, lead])

  return { ...cursor, revealing }
}

const BUSH_KEYS: Readonly<Record<string, Bush>> = {
  Digit1: 0,
  Numpad1: 0,
  ArrowLeft: 0,
  Digit2: 1,
  Numpad2: 1,
  ArrowUp: 1,
  ArrowDown: 1,
  Digit3: 2,
  Numpad3: 2,
  ArrowRight: 2,
}

/** Picks a bush with 1, 2, 3 or the arrow keys (left, up or down, right), for players on a keyboard. */
export function useBushKeys(onPick: (bush: Bush) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      const bush = BUSH_KEYS[event.code]
      if (bush === undefined || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      event.preventDefault()
      onPick(bush)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPick, enabled])
}
