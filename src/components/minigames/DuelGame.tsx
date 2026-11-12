import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { championLoadingUrl } from '../../data'
import {
  bestReactionMs,
  duelRoundResult,
  duelRounds,
  duelWinner,
  roundEndsAt,
  type DuelRound,
  type DuelRoundResult,
} from '../../game/minigames/duel'
import { usePressKey, useStopwatch } from '../multiplayer/games/useStopwatch'
import type { MiniGameProps } from './MiniGameShell'
import { SKINS } from './miniGameArt'

/** Seconds the round result stays up before the next standoff. */
const BETWEEN_ROUNDS = 2.2
/** "Ready..." shows for this long, then "Steady..." until DRAW. */
const READY_SECONDS = 1

const REASONS: Record<DuelRoundResult['reason'], string> = {
  faster: 'Bang! Headshot.',
  slower: 'Jhin was faster. “And now... four.”',
  'player-early': 'You shot before DRAW. Not very sheriff of you.',
  'bot-early': 'Jhin fired early. Art can’t be rushed, Jhin.',
}

const formatMs = (seconds: number | null) => (seconds === null ? '—' : `${Math.round(seconds * 1000)} ms`)

/** Sheriff Caitlyn vs High Noon Jhin: wait for DRAW, then shoot first. Best of 3. */
export function DuelGame({ seed, onFinish }: MiniGameProps) {
  const rounds = useMemo(() => duelRounds(seed), [seed])
  const [results, setResults] = useState<DuelRoundResult[]>([])
  const [standoff, setStandoff] = useState(true)
  const round = rounds[results.length]
  const last = results.at(-1)
  const winner = duelWinner(results)

  const resolve = useCallback(
    (shotAt: number | null) => {
      if (!round) return
      setStandoff(false)
      setResults((done) => [...done, duelRoundResult(round, shotAt)])
    },
    [round],
  )

  // After a round: the next standoff, or the end of the duel.
  useEffect(() => {
    if (standoff || results.length === 0) return
    const id = window.setTimeout(() => {
      if (!winner) {
        setStandoff(true)
        return
      }
      const wins = results.filter((result) => result.winner === 'player').length
      const best = (side: 'player' | 'bot') => {
        const ms = bestReactionMs(results, side)
        return ms === null ? '' : ` · best ${ms} ms`
      }
      onFinish({ winner, player: `${wins} won${best('player')}`, bot: `${results.length - wins} won${best('bot')}` })
    }, BETWEEN_ROUNDS * 1000)
    return () => window.clearTimeout(id)
  }, [standoff, results, winner, onFinish])

  return (
    <div className="flex flex-col items-center gap-3">
      <RoundDots results={results} />
      {standoff && round ? (
        <Standoff key={results.length} round={round} onResolve={resolve} />
      ) : (
        <Arena call={null} drawn={false} result={last ?? null} onShoot={() => {}} />
      )}
      <p className="text-sm text-gold-light/60">Click, tap or press Space to shoot. Only after DRAW!</p>
    </div>
  )
}

/** One round, from "Ready..." until someone shoots. Mounted fresh each round so its clock starts at 0. */
function Standoff({ round, onResolve }: { round: DuelRound; onResolve: (shotAt: number | null) => void }) {
  const { seconds, read } = useStopwatch(true)
  const shoot = useCallback(() => onResolve(read()), [onResolve, read])
  usePressKey(shoot, true)

  // The bot's shot ends the round if the player hasn't shot yet.
  useEffect(() => {
    const id = window.setTimeout(() => onResolve(null), roundEndsAt(round) * 1000)
    return () => window.clearTimeout(id)
  }, [round, onResolve])

  const drawn = seconds >= round.drawAt
  const call = drawn ? 'DRAW!' : seconds < READY_SECONDS ? 'Ready...' : 'Steady...'
  return <Arena call={call} drawn={drawn} result={null} onShoot={shoot} />
}

interface ArenaProps {
  call: string | null
  drawn: boolean
  /** The round just played, shown between rounds. */
  result: DuelRoundResult | null
  onShoot: () => void
}

function Arena({ call, drawn, result, onShoot }: ArenaProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Shoot"
      onPointerDown={onShoot}
      className={`relative flex h-72 w-full cursor-crosshair touch-manipulation items-end justify-between overflow-hidden rounded-lg border-2 select-none sm:h-80 ${
        drawn ? 'border-red-500' : 'border-gold/40'
      } bg-linear-to-b from-orange-300/30 via-amber-700/30 to-yellow-950/70`}
    >
      <div className="absolute top-6 left-1/2 size-24 -translate-x-1/2 rounded-full bg-amber-200/40 blur-md" aria-hidden="true" />
      <Duelist
        src={championLoadingUrl('Caitlyn', SKINS.sheriffCaitlyn)}
        alt="Sheriff Caitlyn"
        fell={result?.winner === 'bot'}
        fired={result?.reason === 'faster'}
      />
      <div className="absolute inset-x-0 top-1/3 flex flex-col items-center" aria-live="assertive">
        <AnimatePresence mode="popLayout">
          {call && (
            <motion.span
              key={call}
              initial={{ scale: drawn ? 2.5 : 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: drawn ? 0.08 : 0.3 }}
              className={`font-display font-black drop-shadow-[0_2px_6px_rgb(0_0_0/0.9)] ${
                drawn ? 'text-7xl text-red-500 sm:text-8xl' : 'text-4xl text-gold-light'
              }`}
            >
              {call}
            </motion.span>
          )}
        </AnimatePresence>
        {result && <RoundCall result={result} />}
      </div>
      <Duelist
        src={championLoadingUrl('Jhin', SKINS.highNoonJhin)}
        alt="High Noon Jhin"
        mirrored
        fell={result?.winner === 'player'}
        fired={result?.reason === 'slower'}
      />
    </div>
  )
}

function Duelist({ src, alt, mirrored = false, fell, fired }: { src: string; alt: string; mirrored?: boolean; fell: boolean; fired: boolean }) {
  return (
    <motion.div
      className="relative h-full w-[34%] max-w-40"
      animate={fell ? { rotate: mirrored ? 14 : -14, y: 30, opacity: 0.45 } : { rotate: 0, y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 180, damping: 14 }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={`h-full w-full object-cover object-top [mask-image:linear-gradient(to_bottom,black_75%,transparent)] ${mirrored ? '-scale-x-100' : ''} ${fell ? 'grayscale' : ''}`}
      />
      {fired && (
        <motion.span
          initial={{ scale: 0.2, opacity: 1 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 0.5 }}
          className={`absolute top-1/2 size-12 rounded-full bg-yellow-200 blur-sm ${mirrored ? 'left-0' : 'right-0'}`}
          aria-hidden="true"
        />
      )}
    </motion.div>
  )
}

function RoundCall({ result }: { result: DuelRoundResult }) {
  return (
    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mt-2 flex flex-col items-center gap-1 px-2 text-center">
      <p className={`font-display text-2xl font-black ${result.winner === 'player' ? 'text-gold' : 'text-red-400'} drop-shadow-[0_2px_4px_rgb(0_0_0/0.9)]`}>
        {result.winner === 'player' ? 'Round won' : 'Round lost'}
      </p>
      <p className="max-w-56 text-sm text-gold-light drop-shadow-[0_1px_3px_rgb(0_0_0/0.9)]">{REASONS[result.reason]}</p>
      {(result.reason === 'faster' || result.reason === 'slower') && (
        <p className="rounded bg-abyss/70 px-2 py-0.5 font-mono text-xs text-gold-light">
          You {formatMs(result.playerReaction)} · Jhin {formatMs(result.botReaction)}
        </p>
      )}
    </motion.div>
  )
}

function RoundDots({ results }: { results: DuelRoundResult[] }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Round ${results.length + 1}`}>
      {[0, 1, 2].map((index) => {
        const result = results[index]
        const color = !result ? 'border-gold/40' : result.winner === 'player' ? 'border-gold bg-gold' : 'border-red-400 bg-red-400'
        return <span key={index} className={`size-3 rounded-full border-2 ${color}`} />
      })}
    </div>
  )
}
