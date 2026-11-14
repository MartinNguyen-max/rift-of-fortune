import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { mapIconUrl, spellIconUrl } from '../../data'
import {
  crashSeconds,
  NO_STOP,
  RACE,
  RACE_SCORE,
  raceOutcomes,
  runDistance,
  runOutcome,
  runSpeed,
  totalScore,
  trackOfRun,
  type RaceTrack,
  type RunOutcome,
} from '../../game/minigames/race'
import { other, type Player } from '../../game/minigames/versus'
import { GetReady } from './GetReady'
import { championIconById } from './miniGameArt'
import { BigCall, ContestantTag, Waiting } from './parts'
import { describeStop, laneShare, RUN_CALLS, runCall } from './raceScreen'
import { useStepFlow } from './stepFlow'
import { useShownWhen } from './timing'
import type { Contestant, MiniGameViewProps, TutorialArtProps } from './types'
import { usePressKey, useStopwatch } from './useStopwatch'

/** Sion's ult, Unstoppable Onslaught. */
const SION_R = spellIconUrl('SionR.png')
const TOWER = mapIconUrl('tower')
/** Your stop shows on its own for a moment before the opponent's. */
const REVEAL_MS = 1600
/**
 * How long a run stays up once both are in, before the next one: your stop, the opponent's
 * and a moment to compare. Against the bot both are in the moment you tap.
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
 * Sion vs Vi: Sion charges by himself, faster and faster. Tap STOP on the enemy team, before their tower.
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
      <p className="text-center text-xs text-gold-light/60">Tap anywhere (or Space) to stop Sion.</p>
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

type Phase = 'countdown' | 'running' | 'done'

interface RaceRunProps {
  track: RaceTrack
  /** Your tap for this run once it is in. */
  myMove: number | undefined
  /** The opponent's tap, once it may be shown. */
  theirMove: number | undefined
  /** The opponent's name while their run hasn't arrived. */
  waitingFor: string | null
  me: Player
  players: readonly [Contestant, Contestant]
  onRun: (stopMs: number) => void
}

/**
 * One run: 3-2-1, then Sion charges and you tap STOP. Mounted fresh per run. A run that is
 * already in (after a reconnect) shows where Sion stopped at once.
 */
function RaceRun({ track, myMove, theirMove, waitingFor, me, players, onRun }: RaceRunProps) {
  const [phase, setPhase] = useState<Phase>(() => (myMove === undefined ? 'countdown' : 'done'))
  const [stopMs, setStopMs] = useState<number | null>(null)
  const { seconds, read } = useStopwatch(phase === 'running')
  const sent = useRef(false)

  const finish = useCallback(
    (ms: number) => {
      if (sent.current) return
      sent.current = true
      setStopMs(ms)
      onRun(ms)
      setPhase('done')
    },
    [onRun],
  )
  const go = useCallback(() => setPhase('running'), [])
  const stop = useCallback(() => {
    if (phase === 'running') finish(Math.round(read() * 1000))
  }, [phase, finish, read])
  usePressKey(stop, phase === 'running')

  // No tap before the tower: Sion runs into it.
  useEffect(() => {
    if (phase === 'running' && seconds >= crashSeconds(track)) finish(NO_STOP)
  }, [phase, track, seconds, finish])

  const move = stopMs ?? myMove
  const outcome = move === undefined ? null : runOutcome(track, move)
  const position = phase === 'running' ? runDistance(track, seconds) : phase === 'done' && outcome ? outcome.stop : 0
  const speed = phase === 'running' ? runSpeed(track, seconds) : 0
  const theirOutcome = theirMove === undefined ? null : runOutcome(track, theirMove)

  return (
    <div
      className="flex w-full cursor-pointer touch-none flex-col items-center gap-3 select-none [-webkit-touch-callout:none]"
      onPointerDown={stop}
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
        call={phase === 'done' && outcome ? runCall(outcome) : null}
        ghost={theirOutcome && { outcome: theirOutcome, champion: players[other(me)].champion }}
      >
        {phase === 'countdown' && <GetReady onGo={go} />}
        {phase === 'done' && outcome && <StopCall outcome={outcome} />}
      </Lane>
      <div className="flex h-28 w-full items-center justify-center">
        {phase !== 'done' ? (
          <StopButton enabled={phase === 'running'} speed={speed} />
        ) : outcome && theirOutcome ? (
          <RunVersus mine={outcome} theirs={theirOutcome} me={me} players={players} />
        ) : (
          waitingFor && <Waiting name={waitingFor} />
        )}
      </div>
    </div>
  )
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
function StopCall({ outcome }: { outcome: RunOutcome }) {
  const call = runCall(outcome)
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
        {describeStop(outcome)} · {outcome.score} pts
      </motion.span>
    </div>
  )
}

/** The big round button: it only shows what to do; a tap anywhere on the run stops Sion. */
function StopButton({ enabled, speed }: { enabled: boolean; speed: number }) {
  return (
    <motion.div
      aria-hidden="true"
      animate={enabled ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={enabled ? { duration: 0.5, repeat: Infinity } : { duration: 0.15 }}
      className={`relative flex size-28 items-center justify-center overflow-hidden rounded-full border-4 border-gold bg-abyss shadow-lg shadow-gold/40 ${
        enabled ? '' : 'opacity-40'
      }`}
    >
      <img src={SION_R} alt="" draggable={false} className="absolute inset-0 size-full object-cover opacity-80" />
      <span className="relative flex flex-col items-center font-display font-black text-white drop-shadow-[0_2px_4px_black]">
        <span className="text-2xl">STOP</span>
        {enabled && <span className="font-mono text-sm tabular-nums">{Math.round(speed)} m/s</span>}
      </span>
    </motion.div>
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

/** 1: Sion charges by himself. 2: tap STOP in the zone. 3: middle = 100, the tower = crash. */
export function RaceTutorialArt({ step }: TutorialArtProps) {
  if (step === 0) {
    return (
      <MiniLane>
        <motion.img
          src={championIconById('Sion')}
          alt=""
          animate={{ left: ['10%', '80%'] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeIn', repeatDelay: 0.4 }}
          className={tutorialSion}
        />
        <span className="absolute top-[6%] left-[6%] rounded bg-hextech/80 px-1 font-display text-[9px] font-black text-abyss sm:text-xs">GO!</span>
      </MiniLane>
    )
  }
  if (step === 1) {
    return (
      <MiniLane>
        <motion.img
          src={championIconById('Sion')}
          alt=""
          animate={{ left: ['10%', '65%', '65%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeIn', times: [0, 0.6, 1] }}
          className={tutorialSion}
        />
        <span className="absolute top-[6%] left-[6%] rounded bg-gold/80 px-1 font-display text-[9px] font-black text-abyss sm:text-xs">STOP!</span>
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
