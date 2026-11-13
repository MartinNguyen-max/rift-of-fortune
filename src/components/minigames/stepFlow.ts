import { useCallback, useEffect, useRef, useState } from 'react'
import { other, withMove, type BothMoves, type Moves, type Player } from '../../game/minigames/versus'
import { useTimeout } from './timing'
import { usePressKey, useStopwatch } from './useStopwatch'

interface StepFlowOptions {
  moves: BothMoves
  me: Player
  steps: number
  sendMove: (step: number, value: number) => void
  /** How long after your move the opponent's move for the same step shows. */
  revealMs: number
  /** How long a finished step stays on screen before the next one starts. */
  pauseMs: number
}

/**
 * The flow of a game where both players make one timed move per step (a bar, a duel): the step
 * on screen, your move for it (shown at once, before it comes back in `moves`, or one the host
 * filled in), and the opponent's move, but only once yours is in.
 */
export function useStepFlow({ moves, me, steps, sendMove, revealMs, pauseMs }: StepFlowOptions) {
  const [step, setStep] = useState(0)
  const [sent, setSent] = useState<Moves>([])
  const [revealedStep, setRevealedStep] = useState(-1)
  const myMove = moves[me][step] ?? sent[step]
  const theirMove = moves[other(me)][step]
  const pressed = myMove !== undefined
  const bothIn = moves[me][step] !== undefined && theirMove !== undefined
  const last = step >= steps - 1

  useEffect(() => {
    if (!pressed) return
    const id = window.setTimeout(() => setRevealedStep(step), revealMs)
    return () => window.clearTimeout(id)
  }, [pressed, step, revealMs])

  useEffect(() => {
    if (!bothIn || last) return
    const id = window.setTimeout(() => setStep(step + 1), pauseMs)
    return () => window.clearTimeout(id)
  }, [bothIn, last, step, pauseMs])

  const send = useCallback(
    (value: number) => {
      setSent((current) => withMove(current, step, value))
      sendMove(step, value)
    },
    [sendMove, step],
  )

  return {
    step,
    myMove,
    /** The opponent's move for this step, once it may be shown. */
    theirMove: pressed && revealedStep >= step ? theirMove : undefined,
    /** Your move is in, theirs hasn't arrived yet (Multiplayer). */
    waiting: pressed && theirMove === undefined,
    /** The last step is played by both. */
    over: bothIn && last,
    send,
  }
}

interface TimedPressOptions {
  /** Your move for this step once it is in; the clock stops then. */
  move: number | undefined
  /** After this long without a press, `missed` is sent. */
  limitMs: number
  missed: number
  onPress: (ms: number) => void
}

/**
 * One press against the clock, by tap, click, Space or Enter: the clock starts with `start()`
 * (after the 3-2-1) and the press is sent as ms since then, once.
 */
export function useTimedPress({ move, limitMs, missed, onPress }: TimedPressOptions) {
  const [started, setStarted] = useState(false)
  const running = started && move === undefined
  const { seconds, read } = useStopwatch(running)
  const fired = useRef(false)

  const fire = useCallback(
    (ms: number) => {
      if (fired.current) return
      fired.current = true
      onPress(ms)
    },
    [onPress],
  )
  const press = useCallback(() => {
    if (running) fire(Math.round(read() * 1000))
  }, [running, read, fire])
  usePressKey(press, running)
  useTimeout(() => fire(missed), limitMs, running)
  const start = useCallback(() => setStarted(true), [])

  return { started, running, seconds, press, start }
}

export const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0)
