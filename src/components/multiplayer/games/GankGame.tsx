import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { summonersRiftMapUrl } from '../../../data'
import { LANES, type Lane } from '../../../game/match/types'
import { pickRandom } from '../../../game/random'
import { TIMINGS } from '../../../game/multiplayer/session'
import { BUSH_NAMES } from '../../../game/multiplayer/liveEvents'
import { useCountdown } from '../useCountdown'

/** Where each bush sits on the minimap, in percent. */
const BUSH_SPOTS: Record<Lane, { x: number; y: number }> = {
  top: { x: 18, y: 22 },
  mid: { x: 44, y: 56 },
  bot: { x: 78, y: 82 },
}

interface GankGameProps {
  /** You are the jungler hiding; otherwise you guess where they are. */
  amGanker: boolean
  /** The bush the jungler hid in, once they chose (never shown to the guesser). */
  hidden: boolean
  /** When the jungler hid (Date.now()), so the guesser's timer starts then. */
  hiddenAt: number | null
  opponentName: string
  onHide: (bush: Lane) => void
  onGuess: (bush: Lane | null) => void
}

/** The gank mind game: the jungler picks a bush, the other player guesses which one. */
export function GankGame({ amGanker, hidden, hiddenAt, opponentName, onHide, onGuess }: GankGameProps) {
  const [startedAt] = useState(() => Date.now())
  const [choice, setChoice] = useState<Lane | null>(null)
  const [answered, setAnswered] = useState(false)
  const myTurn = !answered && (amGanker || hidden)
  const limit = amGanker ? TIMINGS.gankHide : TIMINGS.gankGuess
  // The guesser's clock starts once the jungler hid, but never before their own intro ended.
  const deadline = (amGanker ? startedAt : Math.max(hiddenAt ?? startedAt, startedAt)) + limit * 1000
  const remaining = useCountdown(deadline)

  const choose = (bush: Lane) => {
    if (!myTurn) return
    setChoice(bush)
    setAnswered(true)
    if (amGanker) onHide(bush)
    else onGuess(bush)
  }

  // Out of time: the jungler hides somewhere random, the guesser doesn't guess at all.
  useEffect(() => {
    if (!myTurn) return
    const timeout = () => {
      setAnswered(true)
      if (amGanker) {
        const bush = pickRandom(LANES)
        setChoice(bush)
        onHide(bush)
      } else {
        onGuess(null)
      }
    }
    const id = window.setTimeout(timeout, Math.max(0, deadline - Date.now()))
    return () => window.clearTimeout(id)
  }, [myTurn, deadline, amGanker, onHide, onGuess])

  const instruction = amGanker
    ? choice
      ? `Hiding in ${BUSH_NAMES[choice]}. Waiting for ${opponentName}…`
      : 'Pick ONE bush to hide in'
    : !hidden
      ? 'The enemy is hiding…'
      : answered
        ? 'Guess locked in!'
        : 'GUESS which bush they are in'

  return (
    <div className="flex flex-col items-center gap-3">
      <h2 className="text-center font-display text-2xl font-black text-gold" aria-live="polite">
        {instruction}
      </h2>
      {myTurn && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-abyss/80" role="timer" aria-label={`${Math.ceil(remaining)} seconds left`}>
          <div className="h-full bg-red-400 transition-[width] duration-200 ease-linear" style={{ width: `${(remaining / limit) * 100}%` }} />
        </div>
      )}
      <div className="relative aspect-square w-full max-w-xs">
        <img src={summonersRiftMapUrl} alt="" className="absolute inset-0 size-full rounded-xl border border-gold/40 object-cover opacity-60" />
        {LANES.map((bush) => {
          const { x, y } = BUSH_SPOTS[bush]
          const picked = choice === bush
          return (
            <motion.button
              key={bush}
              type="button"
              disabled={!myTurn}
              onClick={() => choose(bush)}
              whileTap={{ scale: 0.85 }}
              animate={myTurn ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={myTurn ? { duration: 1, repeat: Infinity } : undefined}
              style={{ left: `${x}%`, top: `${y}%` }}
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-xl border-2 px-2 py-1 font-display text-sm font-bold transition disabled:cursor-default ${
                picked ? 'border-gold bg-gold/30 text-gold' : myTurn ? 'border-green-400 bg-green-900/70 text-green-100' : 'border-gold/20 bg-abyss/70 text-gold-light/50'
              }`}
            >
              <span className="text-2xl" aria-hidden="true">
                🌿
              </span>
              {BUSH_NAMES[bush]}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
