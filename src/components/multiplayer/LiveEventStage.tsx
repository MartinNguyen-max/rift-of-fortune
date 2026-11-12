import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import type { Lane, Side } from '../../game/match/types'
import { eventSeed, LIVE_EVENTS, liveScript } from '../../game/multiplayer/liveEvents'
import type { PlayerId, RoomMessage } from '../../game/multiplayer/protocol'
import { playerOn, type RoundState } from '../../game/multiplayer/session'
import { EventReveal } from './EventReveal'
import { GankGame } from './games/GankGame'
import { SmiteGame } from './games/SmiteGame'
import { UltGame } from './games/UltGame'

/** How long the result stays up before the match goes on. */
const REVEAL_MS = 3500

interface LiveEventStageProps {
  round: RoundState
  /** Which live event (0–3). */
  index: number
  myId: PlayerId
  mySide: Side
  send: (message: RoomMessage) => void
  /** The result has been shown: play on. */
  onDone: () => void
}

/**
 * One live event over the match: tells the host this player got here, plays the mini-game, sends
 * the score, waits for the opponent, then shows who won.
 */
export function LiveEventStage({ round, index, myId, mySide, send, onDone }: LiveEventStageProps) {
  const event = round.events[index]
  const kind = LIVE_EVENTS[index]?.kind ?? 'teamfight'
  const seed = round.match?.seed ?? 0
  const result = event?.result ?? null
  const [played, setPlayed] = useState(false)
  const opponentName = playerOn(round, mySide === 'blue' ? 'red' : 'blue')?.name ?? 'Opponent'
  const ganker = liveScript(seed)[index]?.ganker ?? 'blue'

  useEffect(() => {
    send({ type: 'arrived', round: round.id, event: index, player: myId })
  }, [send, round.id, index, myId])

  // Once the result is in, show it for a moment and play on. If the host settled the event
  // before this player finished (they fell too far behind), the result shows right away.
  const showResult = result !== null
  useEffect(() => {
    if (!showResult) return
    const id = window.setTimeout(onDone, REVEAL_MS)
    return () => window.clearTimeout(id)
  }, [showResult, onDone])

  const submitScore = useCallback(
    (score: number) => {
      setPlayed(true)
      send({ type: 'score', round: round.id, event: index, player: myId, score })
    },
    [send, round.id, index, myId],
  )
  const hide = useCallback(
    (bush: Lane) => {
      setPlayed(true)
      send({ type: 'hide', round: round.id, event: index, bush })
    },
    [send, round.id, index],
  )
  const guess = useCallback(
    (bush: Lane | null) => {
      setPlayed(true)
      send({ type: 'guess', round: round.id, event: index, bush })
    },
    [send, round.id, index],
  )

  const game =
    kind === 'gank' ? (
      <GankGame
        amGanker={ganker === mySide}
        hidden={event?.bush !== null && event?.bush !== undefined}
        hiddenAt={event?.hiddenAt ?? null}
        opponentName={opponentName}
        onHide={hide}
        onGuess={guess}
      />
    ) : kind === 'teamfight' ? (
      <UltGame seed={eventSeed(seed, index)} onScore={submitScore} />
    ) : (
      <SmiteGame target={kind} seed={eventSeed(seed, index)} onScore={submitScore} />
    )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-abyss/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Live event"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border-2 border-gold/60 bg-panel p-5 shadow-2xl shadow-black">
        <p className="text-center text-[10px] tracking-[0.3em] text-hextech uppercase">
          Live event {index + 1} / {LIVE_EVENTS.length}
        </p>
        {showResult && result ? (
          <EventReveal kind={kind} result={result} mySide={mySide} opponentName={opponentName} />
        ) : (
          <>
            {game}
            {played && kind !== 'gank' && (
              <p className="text-center text-sm text-gold-light/60" aria-live="polite">
                Waiting for {opponentName}…
              </p>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}
