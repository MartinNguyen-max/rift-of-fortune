import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { championLoadingUrl } from '../../data'
import {
  drawTimes,
  DUEL_MAX_ROUNDS,
  duelResults,
  duelWinner,
  NO_SHOT,
  SHOT_WINDOW,
  type DuelRoundResult,
} from '../../game/minigames/duel'
import { other, type Player } from '../../game/minigames/versus'
import { championIconById, SKINS } from './miniGameArt'
import { BigCall, ContestantTag, Waiting } from './parts'
import { useShownWhen } from './timing'
import type { Contestant, MiniGameViewProps, TutorialArtProps } from './types'
import { usePressKey, useStopwatch } from './useStopwatch'

/** Seconds the round result stays up before the next standoff. */
const BETWEEN_ROUNDS = 2.4
/** "Ready..." shows for this long, then "Steady..." until DRAW. */
const READY_SECONDS = 1

const formatMs = (ms: number | null) => (ms === null ? '—' : `${ms} ms`)

/** Sheriff Caitlyn vs High Noon Jhin: wait for DRAW, then shoot first. Best of 3. */
export function DuelGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const draws = useMemo(() => drawTimes(setup.seed), [setup.seed])
  const results = useMemo(() => duelResults(moves, setup.seed), [moves, setup.seed])
  const over = duelWinner(results) !== null
  /** Rounds whose result has been shown. */
  const [seen, setSeen] = useState(0)
  const showing = results[seen]

  useEffect(() => {
    if (!showing) return
    const id = window.setTimeout(() => setSeen(seen + 1), BETWEEN_ROUNDS * 1000)
    return () => window.clearTimeout(id)
  }, [showing, seen])
  useShownWhen(over && seen >= results.length, onShown, 200)

  const round = seen
  const drawAt = draws[round]
  const myShot = moves[me][round]
  const shoot = useCallback((ms: number) => sendMove(round, ms), [sendMove, round])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ContestantTag contestant={players[me]} you value={`${seenWins(results, seen, me)}`} />
        <RoundDots results={results.slice(0, seen)} me={me} />
        <ContestantTag contestant={players[them]} you={false} value={`${seenWins(results, seen, them)}`} />
      </div>
      {showing ? (
        <Arena call={null} drawn={false} result={showing} me={me} them={players[them]} onShoot={() => {}} />
      ) : drawAt !== undefined && !over && myShot === undefined ? (
        <Standoff key={round} drawAt={drawAt} theirShot={moves[them][round]} me={me} them={players[them]} onShoot={shoot} />
      ) : (
        <Arena call={null} drawn={false} result={null} me={me} them={players[them]} onShoot={() => {}} />
      )}
      {!showing && !over && myShot !== undefined && <Waiting name={players[them].name} />}
      <p className="text-sm text-gold-light/60">Click, tap or press Space to shoot. Only after DRAW!</p>
    </div>
  )
}

const seenWins = (results: readonly DuelRoundResult[], seen: number, player: Player) =>
  results.slice(0, seen).filter(({ winner }) => winner === player).length

interface StandoffProps {
  drawAt: number
  /** The opponent's shot this round, once known (the bot's is known up front). */
  theirShot: number | undefined
  me: Player
  them: Contestant
  onShoot: (ms: number) => void
}

/** One round, from "Ready..." until you shoot. Mounted fresh each round so its clock starts at 0. */
function Standoff({ drawAt, theirShot, me, them, onShoot }: StandoffProps) {
  const { seconds, read } = useStopwatch(true)
  const fired = useRef(false)
  const fire = useCallback(
    (ms: number) => {
      if (fired.current) return
      fired.current = true
      onShoot(ms)
    },
    [onShoot],
  )
  const shoot = useCallback(() => fire(Math.round(read() * 1000)), [fire, read])
  usePressKey(shoot, true)

  // Too slow: the round is over once the opponent has shot (or jumped the gun), or the window closes.
  const deadline = Math.min(drawAt + SHOT_WINDOW * 1000, theirShot ?? Infinity)
  useEffect(() => {
    const id = window.setTimeout(() => fire(NO_SHOT), Math.max(0, deadline - read() * 1000))
    return () => window.clearTimeout(id)
  }, [deadline, read, fire])

  const drawn = seconds * 1000 >= drawAt
  const call = drawn ? 'DRAW!' : seconds < READY_SECONDS ? 'Ready...' : 'Steady...'
  return <Arena call={call} drawn={drawn} result={null} me={me} them={them} onShoot={shoot} />
}

interface ArenaProps {
  call: string | null
  drawn: boolean
  /** The round just played, shown between rounds. */
  result: DuelRoundResult | null
  me: Player
  them: Contestant
  onShoot: () => void
}

function Arena({ call, drawn, result, me, them, onShoot }: ArenaProps) {
  const won = result?.winner === me
  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label="Shoot"
      onPointerDown={onShoot}
      animate={result ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
      transition={{ duration: 0.35 }}
      className={`relative flex h-72 w-full cursor-crosshair touch-manipulation items-end justify-between overflow-hidden rounded-lg border-2 select-none sm:h-80 ${
        drawn ? 'border-red-500' : result ? (won ? 'border-gold' : 'border-red-500') : 'border-gold/40'
      } bg-linear-to-b from-orange-300/30 via-amber-700/30 to-yellow-950/70`}
    >
      <div className="absolute top-6 left-1/2 size-24 -translate-x-1/2 rounded-full bg-amber-200/40 blur-md" aria-hidden="true" />
      <Duelist
        src={championLoadingUrl('Caitlyn', SKINS.sheriffCaitlyn)}
        alt="Sheriff Caitlyn"
        fell={result !== null && !won}
        fired={result !== null && won && result.reason === 'faster'}
      />
      <div className="absolute inset-x-0 top-1/4 flex flex-col items-center" aria-live="assertive">
        {call && (
          <motion.span
            key={call}
            initial={{ scale: drawn ? 2.5 : 1.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: drawn ? 0.08 : 0.3 }}
            className={`font-display font-black drop-shadow-[0_2px_6px_rgb(0_0_0/0.9)] ${
              drawn ? 'text-7xl text-red-500 sm:text-8xl' : 'text-4xl text-gold-light'
            }`}
          >
            {call}
          </motion.span>
        )}
      </div>
      {result && <RoundCall result={result} me={me} them={them} />}
      <Duelist
        src={championLoadingUrl('Jhin', SKINS.highNoonJhin)}
        alt="High Noon Jhin"
        mirrored
        fell={result !== null && won}
        fired={result !== null && !won && result.reason === 'faster'}
      />
    </motion.div>
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

function reason(result: DuelRoundResult, won: boolean, them: Contestant): string {
  if (result.reason === 'early') return won ? `${them.name} shot before DRAW!` : 'You shot before DRAW!'
  if (won) return 'Bang! Headshot.'
  return them.isBot ? 'Jhin was faster. “And now... four.”' : `${them.name} was faster.`
}

/** The round result: a huge WON or LOST that slams in, why, and both reaction times. */
function RoundCall({ result, me, them }: { result: DuelRoundResult; me: Player; them: Contestant }) {
  const won = result.winner === me
  const mine = result.reactions[me]
  const theirs = result.reactions[other(me)]
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 p-2">
      <BigCall text={won ? 'WON' : 'LOST'} tone={won ? 'win' : 'lose'} sub={reason(result, won, them)} />
      {result.reason === 'faster' && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="rounded bg-abyss/80 px-2 py-0.5 font-mono text-sm text-gold-light"
        >
          You {formatMs(mine)} · {them.name} {formatMs(theirs)}
        </motion.p>
      )}
    </div>
  )
}

function RoundDots({ results, me }: { results: DuelRoundResult[]; me: Player }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Round ${results.length + 1}`}>
      {Array.from({ length: DUEL_MAX_ROUNDS }, (_, index) => {
        const result = results[index]
        const color = !result ? 'border-gold/40' : result.winner === me ? 'border-gold bg-gold' : 'border-red-400 bg-red-400'
        return <span key={index} className={`size-3.5 rounded-full border-2 ${color}`} />
      })}
    </div>
  )
}

/** 1: DRAW between the two. 2: a tap and a shot. 3: best of 3. */
export function DuelTutorialArt({ step }: TutorialArtProps) {
  if (step === 0) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-linear-to-b from-orange-300/30 to-yellow-950/70 px-1">
        <motion.span
          animate={{ scale: [0.8, 1.15, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.6 }}
          className="font-display text-sm font-black text-red-500 drop-shadow-[0_1px_2px_black] sm:text-xl"
        >
          DRAW!
        </motion.span>
        <div className="flex w-full items-center justify-between px-1">
          <img src={championIconById('Caitlyn')} alt="" className="size-7 rounded-full border-2 border-hextech sm:size-9" />
          <img src={championIconById('Jhin')} alt="" className="size-7 -scale-x-100 rounded-full border-2 border-red-400 sm:size-9" />
        </div>
      </div>
    )
  }
  if (step === 1) {
    return (
      <div className="relative flex size-full items-center justify-center bg-linear-to-b from-orange-300/20 to-yellow-950/60">
        <motion.span
          animate={{ scale: [1, 1.6, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="absolute size-10 rounded-full bg-yellow-200/60 blur-sm"
        />
        <span className="relative text-4xl">👆</span>
        <span className="absolute right-1.5 bottom-1 rounded border border-gold/50 px-1 font-mono text-[10px] text-gold-light">Space</span>
      </div>
    )
  }
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2">
      <span className="font-display text-sm font-black text-red-500 line-through decoration-2">Ready...</span>
      <div className="flex gap-1.5">
        <span className="size-4 rounded-full border-2 border-gold bg-gold" />
        <span className="size-4 rounded-full border-2 border-gold bg-gold" />
        <span className="size-4 rounded-full border-2 border-gold/40" />
      </div>
    </div>
  )
}
