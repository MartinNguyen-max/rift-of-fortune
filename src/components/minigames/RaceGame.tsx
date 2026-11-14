import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { mapIconUrl, spellIconUrl } from '../../data'
import {
  holdDistance,
  holdSpeed,
  NO_RUN,
  RACE,
  RACE_SCORE,
  raceOutcomes,
  runOutcome,
  totalScore,
  trackOfRun,
  type RaceTrack,
  type RunOutcome,
} from '../../game/minigames/race'
import { other, type Player } from '../../game/minigames/versus'
import { GetReady } from './GetReady'
import { championIconById } from './miniGameArt'
import { BigCall, ContestantTag, Waiting } from './parts'
import { describeStop, laneShare, RUN_CALLS, runCall, slideAt, slideDuration } from './raceScreen'
import { useStepFlow } from './stepFlow'
import { useShownWhen, useTimeout } from './timing'
import type { Contestant, MiniGameViewProps, TutorialArtProps } from './types'
import { useStopwatch } from './useStopwatch'

/** Sion's ult, Unstoppable Onslaught. */
const SION_R = spellIconUrl('SionR.png')
const TOWER = mapIconUrl('tower')
/** Your slide plays out before the opponent's stop shows. */
const REVEAL_MS = 2600
/**
 * How long a run stays up once both are in, before the next one: your slide, the opponent's
 * stop and a moment to compare. Against the bot both are in the moment you let go.
 */
const BETWEEN_RUNS_MS = 5600
/** How long the last run shows before Victory or Defeat. */
const LAST_RUN_MS = 5400
/** The enemy team waiting in the zone: meters from its middle, and how high they stand. */
const ENEMIES = [
  { champion: 'Jinx', at: -4, top: '30%' },
  { champion: 'Lux', at: 0, top: '12%' },
  { champion: 'Ezreal', at: 4, top: '30%' },
] as const

const percent = (share: number) => `${share * 100}%`

/**
 * Sion vs Vi: hold to charge, let go to slide, stop on the enemy team before their tower.
 * Three runs on the same tracks for both players; the most points wins.
 */
export function RaceGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const flow = useStepFlow({ moves, me, steps: RACE.runs, sendMove, revealMs: REVEAL_MS, pauseMs: BETWEEN_RUNS_MS })
  useShownWhen(flow.over, onShown, LAST_RUN_MS)

  const { step } = flow
  const track = useMemo(() => trackOfRun(setup, step), [setup, step])
  const outcomes = useMemo(() => raceOutcomes(moves, setup), [moves, setup])
  // A run counts in the totals once both stops are shown.
  const shown = flow.theirMove === undefined ? step : step + 1
  const mine = outcomes[me].slice(0, shown)
  const theirs = outcomes[them].slice(0, shown)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ContestantTag contestant={players[me]} you value={`${totalScore(mine)}`} />
        <RunDots current={step} mine={mine} theirs={theirs} />
        <ContestantTag contestant={players[them]} you={false} value={`${totalScore(theirs)}`} />
      </div>
      <RaceRun
        key={step}
        track={track}
        myMove={flow.myMove}
        theirMove={flow.theirMove}
        waitingFor={flow.waiting ? players[them].name : null}
        me={me}
        players={players}
        onRun={flow.send}
      />
      <p className="text-center text-xs text-gold-light/60">Hold anywhere (or Space) to charge. Let go to slide.</p>
    </div>
  )
}

/** One dot per run: gold when you scored more, red when they did, a ring on the run being played. */
function RunDots({ current, mine, theirs }: { current: number; mine: readonly RunOutcome[]; theirs: readonly RunOutcome[] }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Run ${current + 1} of ${RACE.runs}`}>
      {Array.from({ length: RACE.runs }, (_, index) => {
        const a = mine[index]?.score
        const b = theirs[index]?.score
        const color =
          a === undefined || b === undefined
            ? index === current
              ? 'border-hextech'
              : 'border-gold/40'
            : a > b
              ? 'border-gold bg-gold'
              : a < b
                ? 'border-red-400 bg-red-400'
                : 'border-gold-light/60 bg-gold-light/60'
        return <span key={index} className={`size-3.5 rounded-full border-2 ${color}`} />
      })}
    </div>
  )
}

type Phase = 'countdown' | 'ready' | 'holding' | 'sliding' | 'done'

interface RaceRunProps {
  track: RaceTrack
  /** Your hold for this run once it is in. */
  myMove: number | undefined
  /** The opponent's hold, once it may be shown. */
  theirMove: number | undefined
  /** The opponent's name while their run hasn't arrived. */
  waitingFor: string | null
  me: Player
  players: readonly [Contestant, Contestant]
  onRun: (holdMs: number) => void
}

/**
 * One run: 3-2-1, then hold to charge and let go to slide. Mounted fresh per run. A run that is
 * already in (after a reconnect) shows where Sion stopped at once.
 */
function RaceRun({ track, myMove, theirMove, waitingFor, me, players, onRun }: RaceRunProps) {
  const [phase, setPhase] = useState<Phase>(() => (myMove === undefined ? 'countdown' : 'done'))
  const [holdMs, setHoldMs] = useState<number | null>(null)
  const { seconds: holdSeconds, read: readHold } = useStopwatch(phase === 'holding')
  const { seconds: slideSeconds } = useStopwatch(phase === 'sliding')
  const sent = useRef(false)

  const finish = useCallback(
    (ms: number) => {
      if (sent.current) return
      sent.current = true
      setHoldMs(ms)
      onRun(ms)
      setPhase(ms === NO_RUN ? 'done' : 'sliding')
    },
    [onRun],
  )
  const go = useCallback(() => setPhase('ready'), [])
  const startHold = useCallback(() => setPhase((current) => (current === 'ready' ? 'holding' : current)), [])
  // A hold always counts as at least 1 ms, so it is never mistaken for no run at all.
  const release = useCallback(() => {
    if (phase === 'holding') finish(Math.max(1, Math.round(readHold() * 1000)))
  }, [phase, finish, readHold])

  useHoldKey(startHold, release, phase === 'ready' || phase === 'holding')
  useTimeout(() => finish(NO_RUN), RACE.startSeconds * 1000, phase === 'ready')

  // Holding all the way into the tower ends the run.
  useEffect(() => {
    if (phase === 'holding' && holdDistance(track, holdSeconds) >= track.tower) finish(Math.round(holdSeconds * 1000))
  }, [phase, track, holdSeconds, finish])

  const held = (holdMs ?? myMove ?? 0) / 1000
  const slide = slideAt(track, held, slideSeconds)
  useTimeout(() => setPhase('done'), slideDuration(track, held) * 1000, phase === 'sliding')

  const move = holdMs ?? myMove
  const outcome = move === undefined ? null : runOutcome(track, move)
  const position =
    phase === 'holding' ? holdDistance(track, holdSeconds) : phase === 'sliding' ? slide.position : phase === 'done' && outcome ? outcome.stop : 0
  const speed = phase === 'holding' ? holdSpeed(track, holdSeconds) : phase === 'sliding' ? slide.speed : 0
  const theirOutcome = theirMove === undefined ? null : runOutcome(track, theirMove)

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (phase !== 'ready') return
    event.currentTarget.setPointerCapture(event.pointerId)
    startHold()
  }

  return (
    <div
      className="flex w-full cursor-pointer touch-none flex-col items-center gap-3 select-none [-webkit-touch-callout:none]"
      onPointerDown={onPointerDown}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="flex w-full justify-between text-xs font-semibold text-gold-light/70">
        <span>
          Target <span className="text-gold">{Math.round(track.target)} m</span>
        </span>
        <span>
          Tower <span className="text-red-400">{Math.round(track.tower)} m</span>
        </span>
      </div>
      <Lane
        track={track}
        position={position}
        speed={speed}
        champion={players[me].champion}
        call={phase === 'done' && outcome && move !== undefined ? runCall(outcome, move) : null}
        ghost={theirOutcome && { outcome: theirOutcome, champion: players[other(me)].champion }}
      >
        {phase === 'countdown' && <GetReady onGo={go} />}
        {phase === 'done' && outcome && move !== undefined && <StopCall outcome={outcome} move={move} />}
      </Lane>
      <div className="flex h-28 w-full items-center justify-center">
        {phase === 'ready' || phase === 'holding' || phase === 'countdown' ? (
          <HoldButton holding={phase === 'holding'} enabled={phase !== 'countdown'} speed={speed} />
        ) : phase === 'sliding' ? (
          <Speedometer speed={speed} />
        ) : outcome && theirOutcome ? (
          <RunVersus mine={outcome} theirs={theirOutcome} me={me} players={players} />
        ) : (
          waitingFor && <Waiting name={waitingFor} />
        )}
      </div>
    </div>
  )
}

/** Space (or Enter) works like a finger: down to charge, up to let go. */
function useHoldKey(onDown: () => void, onUp: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const isHoldKey = (event: KeyboardEvent) => event.code === 'Space' || event.code === 'Enter'
    const down = (event: KeyboardEvent) => {
      if (!isHoldKey(event)) return
      event.preventDefault()
      if (!event.repeat) onDown()
    }
    const up = (event: KeyboardEvent) => {
      if (!isHoldKey(event)) return
      event.preventDefault()
      onUp()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [onDown, onUp, enabled])
}

interface LaneProps {
  track: RaceTrack
  /** Sion's place, in meters. */
  position: number
  speed: number
  champion: string
  call: ReturnType<typeof runCall> | null
  ghost: { outcome: RunOutcome; champion: string } | null
  children?: ReactNode
}

/** The lane from the start to the enemy tower: the gold zone with the enemy team, and Sion charging. */
function Lane({ track, position, speed, champion, call, ghost, children }: LaneProps) {
  const at = (meters: number) => percent(laneShare(track, meters))
  const width = (from: number, to: number) => percent(laneShare(track, to) - laneShare(track, from))
  const knocked = call === 'bullseye' || call === 'zone'
  const crashed = call === 'crash'
  return (
    <motion.div
      animate={crashed ? { x: [0, -12, 12, -7, 7, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      className={`relative h-44 w-full overflow-hidden rounded-lg border-2 bg-linear-to-b from-emerald-950/60 via-stone-900/70 to-abyss sm:h-52 ${
        crashed ? 'border-red-500' : knocked ? 'border-gold' : 'border-gold/40'
      }`}
    >
      <div className="absolute inset-x-0 top-[52%] h-[30%] border-y border-stone-500/40 bg-stone-700/50" />
      <div
        className="absolute top-[8%] bottom-[6%] border-x border-gold/50 bg-gold/25"
        style={{ left: at(track.target - RACE_SCORE.zone), width: width(track.target - RACE_SCORE.zone, track.target + RACE_SCORE.zone) }}
      />
      <div
        className="absolute top-[8%] bottom-[6%] bg-gold/60"
        style={{ left: at(track.target - RACE_SCORE.perfect), width: width(track.target - RACE_SCORE.perfect, track.target + RACE_SCORE.perfect) }}
      />
      <div className="absolute top-[8%] bottom-[6%] w-0.5 -translate-x-1/2 bg-white/90" style={{ left: at(track.target) }} />
      <div className="absolute top-[52%] h-[30%] w-1 -translate-x-1/2 bg-white/40" style={{ left: at(0) }} />
      {ENEMIES.map(({ champion: enemy, at: offset, top }, index) => (
        <motion.img
          key={enemy}
          src={championIconById(enemy)}
          alt=""
          draggable={false}
          animate={knocked ? { y: [0, -46, 70], rotate: [0, 120 + index * 60, 260], opacity: [1, 1, 0] } : { y: 0, rotate: 0, opacity: 1 }}
          transition={{ duration: 0.9, delay: index * 0.06 }}
          className="absolute size-6 -translate-x-1/2 rounded-full border-2 border-red-400 sm:size-8"
          style={{ left: at(track.target + offset), top }}
        />
      ))}
      <motion.img
        src={TOWER}
        alt="Enemy tower"
        draggable={false}
        animate={crashed ? { rotate: [0, -8, 6, 0], scale: [1, 1.15, 1] } : {}}
        className="absolute top-[30%] size-14 -translate-x-1/4 object-contain drop-shadow-[0_0_10px_rgb(248_113_113/0.7)] sm:size-16"
        style={{ left: at(track.tower) }}
      />
      <div className="absolute inset-y-0 right-0 bg-red-950/40" style={{ left: at(track.tower) }} />
      {ghost && <Ghost track={track} outcome={ghost.outcome} champion={ghost.champion} />}
      <Sion track={track} position={position} speed={speed} champion={champion} />
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-1">{children}</div>
    </motion.div>
  )
}

/** Sion, with a streak behind him as long as his speed. */
function Sion({ track, position, speed, champion }: { track: RaceTrack; position: number; speed: number; champion: string }) {
  const trail = Math.min(0.5, speed / 120)
  return (
    <div className="pointer-events-none absolute top-[67%]" style={{ left: percent(laneShare(track, position)) }}>
      {speed > 0.5 && (
        <div
          className="absolute top-1/2 right-0 h-3 -translate-y-1/2 rounded-full bg-linear-to-l from-hextech/80 to-transparent"
          style={{ width: `${trail * 22}rem` }}
        />
      )}
      <img
        src={championIconById(champion)}
        alt=""
        draggable={false}
        className="absolute top-1/2 left-0 size-11 max-w-none -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-hextech shadow-[0_0_14px_rgb(10_200_185)] sm:size-12"
      />
    </div>
  )
}

/** The opponent's stop, see-through: where they ended up, or an X at the tower for a crash. */
function Ghost({ track, outcome, champion }: { track: RaceTrack; outcome: RunOutcome; champion: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-none absolute top-[97%]"
      style={{ left: percent(laneShare(track, outcome.stop)) }}
    >
      <img
        src={championIconById(champion)}
        alt=""
        className="absolute bottom-0 left-0 size-7 max-w-none -translate-x-1/2 rounded-full border-2 border-red-400 opacity-75"
      />
      {outcome.crashed && <span className="absolute bottom-1 left-0 -translate-x-1/2 font-display text-2xl font-black text-red-500">✕</span>}
    </motion.div>
  )
}

/** Your stop, big: BULLSEYE!, SHORT!, CRASH!, with the distance and points. */
function StopCall({ outcome, move }: { outcome: RunOutcome; move: number }) {
  const call = runCall(outcome, move)
  const { text, tone } = RUN_CALLS[call]
  return (
    <div className="mt-1 flex flex-col items-center gap-0.5">
      <BigCall text={text} tone={tone} size="large" />
      <motion.span
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded bg-abyss/80 px-2 py-0.5 text-sm font-semibold text-gold-light"
      >
        {call === 'none' ? 'Sion never moved' : describeStop(outcome)} · {outcome.score} pts
      </motion.span>
    </div>
  )
}

/** The big round button: it only shows what to do; the whole run area takes the hold. */
function HoldButton({ holding, enabled, speed }: { holding: boolean; enabled: boolean; speed: number }) {
  return (
    <motion.div
      aria-hidden="true"
      animate={holding ? { scale: 0.9 } : enabled ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={holding || !enabled ? { duration: 0.15 } : { duration: 0.8, repeat: Infinity }}
      className={`relative flex size-28 items-center justify-center overflow-hidden rounded-full border-4 bg-abyss shadow-lg ${
        holding ? 'border-gold shadow-gold/50' : 'border-hextech shadow-cyan-500/40'
      } ${enabled ? '' : 'opacity-40'}`}
    >
      <img src={SION_R} alt="" draggable={false} className="absolute inset-0 size-full object-cover opacity-80" />
      <span className="relative flex flex-col items-center font-display font-black text-white drop-shadow-[0_2px_4px_black]">
        <span className={holding ? 'text-lg' : 'text-2xl'}>{holding ? 'CHARGE' : 'HOLD'}</span>
        {holding && <span className="font-mono text-sm tabular-nums">{Math.round(speed)} m/s</span>}
      </span>
    </motion.div>
  )
}

function Speedometer({ speed }: { speed: number }) {
  return (
    <div className="flex flex-col items-center" aria-live="off">
      <span className="font-mono text-4xl font-black text-hextech tabular-nums">{Math.round(speed)}</span>
      <span className="text-xs tracking-widest text-gold-light/60 uppercase">m/s · sliding</span>
    </div>
  )
}

interface RunVersusProps {
  mine: RunOutcome
  theirs: RunOutcome
  me: Player
  players: readonly [Contestant, Contestant]
}

/** Both stops side by side, the better one in gold. */
function RunVersus({ mine, theirs, me, players }: RunVersusProps) {
  return (
    <motion.div
      initial={{ y: 14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="grid w-full max-w-sm grid-cols-[1fr_auto_1fr] items-center gap-3"
      aria-live="polite"
    >
      <VersusSide contestant={players[me]} you outcome={mine} best={mine.score > theirs.score} />
      <span className="font-display text-lg text-gold/60">vs</span>
      <VersusSide contestant={players[other(me)]} you={false} outcome={theirs} best={theirs.score > mine.score} />
    </motion.div>
  )
}

function VersusSide({ contestant, you, outcome, best }: { contestant: Contestant; you: boolean; outcome: RunOutcome; best: boolean }) {
  const color = best ? 'text-gold' : you ? 'text-hextech' : 'text-red-400'
  return (
    <div className={`flex min-w-0 items-center gap-2 ${you ? 'justify-end' : 'flex-row-reverse justify-end'}`}>
      <img
        src={championIconById(contestant.champion)}
        alt={contestant.name}
        className={`size-10 shrink-0 rounded-full border-2 ${you ? 'border-hextech' : 'border-red-400'}`}
      />
      <div className={`flex min-w-0 flex-col leading-tight ${you ? 'items-start' : 'items-end'}`}>
        <span className={`font-display text-3xl font-black tabular-nums ${color}`}>{outcome.score}</span>
        <span className="text-[11px] text-gold-light/70">{describeStop(outcome)}</span>
      </div>
    </div>
  )
}

/** A small lane for the tutorial pictures: the zone, the tower and whatever moves on it. */
function MiniLane({ children, crash = false }: { children?: ReactNode; crash?: boolean }) {
  return (
    <div className="relative size-full overflow-hidden bg-linear-to-b from-emerald-950/60 via-stone-900/70 to-abyss">
      <div className="absolute inset-x-0 top-[52%] h-[26%] bg-stone-700/60" />
      <div className="absolute top-[28%] bottom-[14%] left-[56%] w-[18%] bg-gold/25" />
      <div className="absolute top-[28%] bottom-[14%] left-[62%] w-[6%] bg-gold/70" />
      <img src={TOWER} alt="" className={`absolute top-[30%] right-[2%] size-[26%] object-contain ${crash ? 'drop-shadow-[0_0_8px_rgb(239_68_68)]' : ''}`} />
      {children}
    </div>
  )
}

const tutorialSion = 'absolute top-[65%] size-[24%] max-w-none -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-hextech'

/** 1: hold and Sion charges. 2: let go and he slides into the zone. 3: middle = 100, the tower = crash. */
export function RaceTutorialArt({ step }: TutorialArtProps) {
  if (step === 0) {
    return (
      <MiniLane>
        <motion.img
          src={championIconById('Sion')}
          alt=""
          animate={{ left: ['10%', '48%'] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeIn', repeatDelay: 0.4 }}
          className={tutorialSion}
        />
        <span className="absolute top-[6%] left-[6%] rounded bg-hextech/80 px-1 font-display text-[9px] font-black text-abyss sm:text-xs">HOLD</span>
      </MiniLane>
    )
  }
  if (step === 1) {
    return (
      <MiniLane>
        <motion.img
          src={championIconById('Sion')}
          alt=""
          animate={{ left: ['30%', '65%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut', repeatDelay: 0.7 }}
          className={tutorialSion}
        />
        <span className="absolute top-[6%] left-[6%] rounded bg-gold/80 px-1 font-display text-[9px] font-black text-abyss sm:text-xs">LET GO</span>
      </MiniLane>
    )
  }
  return (
    <MiniLane crash>
      <motion.span
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="absolute top-[4%] left-[52%] font-display text-base font-black text-gold drop-shadow-[0_0_8px_rgb(200_170_110/0.8)] sm:text-2xl"
      >
        100
      </motion.span>
      <span className="absolute top-[30%] right-[8%] font-display text-xl font-black text-red-500 sm:text-3xl">✕</span>
    </MiniLane>
  )
}
