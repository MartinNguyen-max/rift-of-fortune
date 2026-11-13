import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { championLoadingUrl, mapIconUrl } from '../../data'
import {
  drawTimes,
  DUEL_MAX_ROUNDS,
  duelResults,
  duelWinner,
  NO_SHOT,
  SHOT_WINDOW,
  targetSpots,
  type DuelRoundResult,
  type TargetSpot,
} from '../../game/minigames/duel'
import { other, type Player } from '../../game/minigames/versus'
import { championIconById, SKINS } from './miniGameArt'
import { BigCall, ContestantTag, Waiting } from './parts'
import { useShownWhen } from './timing'
import type { Contestant, MiniGameViewProps, TutorialArtProps } from './types'
import { useStopwatch } from './useStopwatch'

/** Seconds the round result stays up before the next standoff. */
const BETWEEN_ROUNDS = 2.4
/** "Ready..." shows for this long, then "Steady..." until the Baron shows. */
const READY_SECONDS = 1
/** How many missed taps stay marked at once. */
const MISS_MARKS = 4

const formatMs = (ms: number | null) => (ms === null ? '—' : `${ms} ms`)

/**
 * Sheriff Caitlyn vs High Noon Jhin: "Ready... Steady..." then a Baron pops up somewhere in the
 * arena. Tap it first. A tap before it shows loses the round; a tap that misses it just costs
 * time. Best of 3. No keyboard shot: aiming is the game, so a key would beat every tap.
 */
export function DuelGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const draws = useMemo(() => drawTimes(setup.seed), [setup.seed])
  const spots = useMemo(() => targetSpots(setup.seed), [setup.seed])
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
  const spot = spots[round]
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
        <Arena result={showing} me={me} you={players[me]} them={players[them]} />
      ) : drawAt !== undefined && spot && !over && myShot === undefined ? (
        <Standoff key={round} drawAt={drawAt} spot={spot} theirShot={moves[them][round]} me={me} you={players[me]} them={players[them]} onShoot={shoot} />
      ) : (
        <Arena result={null} me={me} you={players[me]} them={players[them]} />
      )}
      {!showing && !over && myShot !== undefined && <Waiting name={players[them].name} />}
      <p className="text-center text-sm text-gold-light/70">
        Tap the <span className="font-semibold text-gold-light">Baron</span> the moment it shows. Too early = round lost.
      </p>
    </div>
  )
}

const seenWins = (results: readonly DuelRoundResult[], seen: number, player: Player) =>
  results.slice(0, seen).filter(({ winner }) => winner === player).length

interface StandoffProps {
  drawAt: number
  /** Where the Baron shows this round. */
  spot: TargetSpot
  /** The opponent's shot this round, once known (the bot's is known up front). */
  theirShot: number | undefined
  me: Player
  you: Contestant
  them: Contestant
  onShoot: (ms: number) => void
}

/** A tap that missed the Baron, marked where it landed (as fractions of the arena). */
interface Miss {
  key: number
  x: number
  y: number
}

/** One round, from "Ready..." until you tap. Mounted fresh each round so its clock starts at 0. */
function Standoff({ drawAt, spot, theirShot, me, you, them, onShoot }: StandoffProps) {
  const { seconds, read } = useStopwatch(true)
  const fired = useRef(false)
  const [misses, setMisses] = useState<Miss[]>([])
  const fire = useCallback(
    (ms: number) => {
      if (fired.current) return
      fired.current = true
      onShoot(ms)
    },
    [onShoot],
  )
  const now = useCallback(() => Math.round(read() * 1000), [read])

  // A tap on the arena: too early before the Baron shows, a miss after it (that only costs time).
  const tapArena = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const ms = now()
      if (ms < drawAt) return fire(ms)
      const box = event.currentTarget.getBoundingClientRect()
      const miss = { key: ms, x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }
      setMisses((current) => [...current.slice(1 - MISS_MARKS), miss])
    },
    [now, drawAt, fire],
  )
  const hit = useCallback(() => fire(Math.max(drawAt, now())), [fire, drawAt, now])

  // Too slow: the round is over once the opponent has shot (or jumped the gun), or the window closes.
  const deadline = Math.min(drawAt + SHOT_WINDOW * 1000, theirShot ?? Infinity)
  useEffect(() => {
    const id = window.setTimeout(() => fire(NO_SHOT), Math.max(0, deadline - read() * 1000))
    return () => window.clearTimeout(id)
  }, [deadline, read, fire])

  const drawn = seconds * 1000 >= drawAt
  const call = drawn ? null : seconds < READY_SECONDS ? 'Ready...' : 'Steady...'
  return (
    <Arena result={null} me={me} you={you} them={them} call={call} drawn={drawn} onTap={tapArena}>
      {drawn && <Target spot={spot} onHit={hit} />}
      {misses.map((miss) => (
        <MissMark key={miss.key} miss={miss} />
      ))}
    </Arena>
  )
}

/** The Baron to shoot: pops up big with a pulsing red ring, so nobody can miss that it's there. */
function Target({ spot, onHit }: { spot: TargetSpot; onHit: () => void }) {
  return (
    <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%` }}>
      <motion.button
        type="button"
        aria-label="Shoot the Baron"
        onPointerDown={(event) => {
          event.stopPropagation()
          onHit()
        }}
        initial={{ scale: 0.2, opacity: 0, rotate: -20 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 700, damping: 16 }}
        className="relative flex cursor-crosshair touch-manipulation items-center justify-center rounded-full p-2"
      >
        <motion.span
          animate={{ scale: [1, 1.3, 1], opacity: [0.9, 0.4, 0.9] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="absolute inset-0 rounded-full border-4 border-red-500"
          aria-hidden="true"
        />
        <img
          src={mapIconUrl('baron')}
          alt=""
          draggable={false}
          className="size-16 rounded-full bg-abyss/85 p-1 shadow-[0_0_24px_6px_rgb(239_68_68/0.7)] sm:size-20"
        />
      </motion.button>
    </div>
  )
}

function MissMark({ miss }: { miss: Miss }) {
  return (
    <motion.span
      initial={{ scale: 0.4, opacity: 1 }}
      animate={{ scale: 1.2, opacity: 0 }}
      transition={{ duration: 0.7 }}
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 font-display text-3xl font-black text-red-400 drop-shadow-[0_1px_3px_black]"
      style={{ left: `${miss.x * 100}%`, top: `${miss.y * 100}%` }}
      aria-hidden="true"
    >
      ✕
    </motion.span>
  )
}

interface ArenaProps {
  /** The round just played, shown between rounds. */
  result: DuelRoundResult | null
  me: Player
  you: Contestant
  them: Contestant
  call?: string | null
  /** The Baron is up. */
  drawn?: boolean
  onTap?: (event: PointerEvent<HTMLDivElement>) => void
  /** The Baron and the missed taps, drawn over the duelists. */
  children?: ReactNode
}

function Arena({ result, me, you, them, call = null, drawn = false, onTap, children }: ArenaProps) {
  const won = result?.winner === me
  return (
    <motion.div
      onPointerDown={onTap}
      animate={result ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
      transition={{ duration: 0.35 }}
      className={`relative flex h-72 w-full cursor-crosshair touch-manipulation items-end justify-between overflow-hidden rounded-lg border-2 select-none sm:h-80 ${
        drawn ? 'border-red-500' : result ? (won ? 'border-gold' : 'border-red-500') : 'border-gold/40'
      } bg-linear-to-b from-orange-300/30 via-amber-700/30 to-yellow-950/70`}
    >
      <div className="absolute top-6 left-1/2 size-24 -translate-x-1/2 rounded-full bg-amber-200/40 blur-md" aria-hidden="true" />
      <Duelist
        src={duelistArt(you.champion)}
        alt={you.name}
        fell={result !== null && !won}
        fired={result !== null && won && result.reason === 'faster'}
      />
      <div className="pointer-events-none absolute inset-x-0 top-1/4 flex flex-col items-center" aria-live="assertive">
        {call && (
          <motion.span
            key={call}
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="font-display text-4xl font-black text-gold-light drop-shadow-[0_2px_6px_rgb(0_0_0/0.9)]"
          >
            {call}
          </motion.span>
        )}
        {drawn && <span className="sr-only">The Baron is up: tap it!</span>}
      </div>
      {children}
      {result && <RoundCall result={result} me={me} them={them} />}
      <Duelist
        src={duelistArt(them.champion)}
        alt={them.name}
        mirrored
        fell={result !== null && won}
        fired={result !== null && !won && result.reason === 'faster'}
      />
    </motion.div>
  )
}

/** The High Noon skins. In Multiplayer the guest plays Jhin, so each side shows its own champion. */
const DUELIST_SKINS: Readonly<Record<string, number>> = { Caitlyn: SKINS.sheriffCaitlyn, Jhin: SKINS.highNoonJhin }
const duelistArt = (champion: string) => championLoadingUrl(champion, DUELIST_SKINS[champion] ?? 0)

function Duelist({ src, alt, mirrored = false, fell, fired }: { src: string; alt: string; mirrored?: boolean; fell: boolean; fired: boolean }) {
  return (
    <motion.div
      className="pointer-events-none relative h-full w-[34%] max-w-40"
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
  if (result.reason === 'early') return won ? `${them.name} shot too early!` : 'Too early! Wait for the Baron.'
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

/** 1: the Baron pops up between the two. 2: a finger taps it. 3: a tap too early loses the round. */
export function DuelTutorialArt({ step }: TutorialArtProps) {
  if (step === 0) {
    return (
      <div className="relative flex size-full flex-col items-center justify-between bg-linear-to-b from-orange-300/30 to-yellow-950/70 px-1 pt-1.5 pb-1">
        <motion.span
          animate={{ opacity: [1, 1, 0, 0] }}
          transition={{ duration: 2.4, times: [0, 0.45, 0.5, 1], repeat: Infinity }}
          className="font-display text-[10px] font-black text-gold-light drop-shadow-[0_1px_2px_black] sm:text-sm"
        >
          Steady...
        </motion.span>
        <motion.img
          src={mapIconUrl('baron')}
          alt=""
          animate={{ scale: [0, 0, 1.2, 1, 1], opacity: [0, 0, 1, 1, 1] }}
          transition={{ duration: 2.4, times: [0, 0.48, 0.56, 0.62, 1], repeat: Infinity }}
          className="absolute top-1/3 left-[55%] size-9 rounded-full bg-abyss/80 ring-2 ring-red-500 sm:size-12"
        />
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
        <img src={mapIconUrl('baron')} alt="" className="size-12 rounded-full bg-abyss/80 ring-2 ring-red-500 sm:size-16" />
        <motion.span
          animate={{ scale: [0.6, 1.6], opacity: [0.9, 0] }}
          transition={{ duration: 1, repeat: Infinity, repeatDelay: 0.4 }}
          className="absolute size-12 rounded-full border-4 border-yellow-200 sm:size-16"
        />
        <motion.span
          animate={{ y: [10, 0, 0, 10] }}
          transition={{ duration: 1.4, times: [0, 0.2, 0.8, 1], repeat: Infinity }}
          className="absolute right-2 bottom-1 text-3xl sm:text-4xl"
        >
          👆
        </motion.span>
        <span className="absolute top-1 left-1 rounded bg-abyss/80 px-1 font-mono text-[10px] text-gold-light">0.38 s</span>
      </div>
    )
  }
  return (
    <div className="flex size-full flex-col items-center justify-center gap-1.5 px-1">
      <div className="relative flex items-center gap-1">
        <span className="font-display text-xs font-black text-gold-light/70 sm:text-sm">Steady...</span>
        <span className="text-2xl">👆</span>
        <span className="absolute -top-1 right-0 font-display text-xl font-black text-red-500 drop-shadow-[0_1px_2px_black]">✕</span>
      </div>
      <div className="flex gap-1.5">
        <span className="size-4 rounded-full border-2 border-gold bg-gold" />
        <span className="size-4 rounded-full border-2 border-red-400 bg-red-400" />
        <span className="size-4 rounded-full border-2 border-gold/40" />
      </div>
    </div>
  )
}
