import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { championLoadingUrl, spellIconUrl } from '../../data'
import {
  isRightPick,
  NO_PICK,
  pickMove,
  readPick,
  realSpot,
  roundOfStep,
  SHADOW_TIMING,
  shadowPicks,
  shadowRoundCount,
  shuffleMs,
  type ShadowRound,
  type Spot,
} from '../../game/minigames/shadows'
import { other, type Player } from '../../game/minigames/versus'
import { championIconById, SKINS } from './miniGameArt'
import { BigCall, ChoiceTimer, ContestantTag, Waiting } from './parts'
import { figurePlaces, shadowPhase, type ShadowPhase } from './shadowsScreen'
import { useStepFlow } from './stepFlow'
import { useShownWhen } from './timing'
import type { Contestant, MiniGameViewProps, TutorialArtProps } from './types'
import { useStopwatch } from './useStopwatch'

const ZED_ART = championLoadingUrl('Zed', SKINS.projectZed)
/** Living Shadow, Zed's W. */
const LIVING_SHADOW = spellIconUrl('ZedW.png')
/** Time from your pick until the opponent's pick shows. */
const REVEAL_MS = 900
/** How long the last round's result shows before Victory or Defeat. */
const LAST_ROUND_MS = 2600
/** How far a figure arcs up or down while swapping, as a share of the arena height. */
const LIFT = 0.2
const SPOT_NAMES = ['left', 'middle', 'right'] as const
const SPOT_KEYS: Record<string, Spot> = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }

const countRight = (picks: readonly boolean[]) => picks.filter(Boolean).length

/** Zed and two Living Shadows: watch the real one, follow the shuffle, tap him. Three rounds, faster each time. */
export function ShadowsGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const rounds = shadowRoundCount()
  const flow = useStepFlow({ moves, me, steps: rounds, sendMove, revealMs: REVEAL_MS, pauseMs: SHADOW_TIMING.betweenMs })
  useShownWhen(flow.over, onShown, LAST_ROUND_MS)

  const { step } = flow
  const round = useMemo(() => roundOfStep(setup, step), [setup, step])
  const picks = useMemo(() => shadowPicks(moves, setup), [moves, setup])
  const mine = [...picks[me].slice(0, step).map(({ right }) => right), ...(flow.myMove === undefined ? [] : [isRightPick(round, flow.myMove)])]
  const theirs = [
    ...picks[them].slice(0, step).map(({ right }) => right),
    ...(flow.theirMove === undefined ? [] : [isRightPick(round, flow.theirMove)]),
  ]

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ContestantTag contestant={players[me]} you value={`${countRight(mine)}`} />
        <RoundDots rounds={rounds} current={step} mine={mine} />
        <ContestantTag contestant={players[them]} you={false} value={`${countRight(theirs)}`} />
      </div>
      <ShadowRoundView
        key={step}
        round={round}
        step={step}
        myMove={flow.myMove}
        theirMove={flow.theirMove}
        waitingFor={flow.waiting ? players[them].name : null}
        me={me}
        players={players}
        onPick={flow.send}
      />
      <p className="text-xs text-gold-light/60">Tap the real Zed, or press 1, 2 or 3</p>
    </div>
  )
}

/** One dot per round: gold when you found Zed, red when a shadow fooled you, a ring on the round being played. */
function RoundDots({ rounds, current, mine }: { rounds: number; current: number; mine: readonly boolean[] }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Round ${current + 1} of ${rounds}`}>
      {Array.from({ length: rounds }, (_, index) => {
        const right = mine[index]
        const color =
          right === undefined ? (index === current ? 'border-hextech' : 'border-gold/40') : right ? 'border-gold bg-gold' : 'border-red-500 bg-red-500/40'
        return <span key={index} className={`size-3.5 rounded-full border-2 ${color}`} />
      })}
    </div>
  )
}

interface ShadowRoundViewProps {
  round: ShadowRound
  step: number
  /** Your pick for this round once it is in. */
  myMove: number | undefined
  /** The opponent's pick, once it may be shown. */
  theirMove: number | undefined
  waitingFor: string | null
  me: Player
  players: readonly [Contestant, Contestant]
  onPick: (move: number) => void
}

/** One round: Zed is pointed out, turns into a shadow, the three swap, you pick. Mounted fresh per round. */
function ShadowRoundView({ round, step, myMove, theirMove, waitingFor, me, players, onPick }: ShadowRoundViewProps) {
  const picked = myMove !== undefined
  const { seconds, read } = useStopwatch(!picked)
  const { phase, shuffleAt } = picked ? { phase: 'pick' as const, shuffleAt: shuffleMs(round) } : shadowPhase(round, step, seconds * 1000)
  const places = figurePlaces(round, shuffleAt)
  const pickOpensAt = shuffleMs(round) + (step === 0 ? SHADOW_TIMING.firstShowMs : SHADOW_TIMING.showMs) + SHADOW_TIMING.blendMs
  const canPick = phase === 'pick' && !picked

  const fired = useRef(false)
  const fire = useCallback(
    (move: number) => {
      if (fired.current) return
      fired.current = true
      onPick(move)
    },
    [onPick],
  )
  const pick = useCallback((spot: Spot) => fire(pickMove(spot, read() * 1000 - pickOpensAt)), [fire, read, pickOpensAt])

  useEffect(() => {
    if (!canPick) return
    const onKey = (event: KeyboardEvent) => {
      const spot = SPOT_KEYS[event.code]
      if (spot === undefined || event.repeat) return
      event.preventDefault()
      pick(spot)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canPick, pick])

  const real = realSpot(round)
  const myPick = myMove === undefined ? null : readPick(myMove)
  const theirPick = theirMove === undefined ? null : readPick(theirMove)

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex h-24 w-full items-center justify-center">
        {myPick ? (
          <PickCall right={myPick.spot === real} missed={myPick.spot === null} real={real} />
        ) : canPick ? (
          <ChoiceTimer seconds={SHADOW_TIMING.pickMs / 1000} onTimeout={() => fire(NO_PICK)} label="Where is Zed?" />
        ) : (
          <PhaseCall phase={phase} step={step} />
        )}
      </div>
      <motion.div
        animate={myPick ? { x: [0, -8, 8, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className={`relative h-64 w-full touch-manipulation overflow-hidden rounded-lg border-2 select-none sm:h-80 ${
          canPick ? 'border-hextech/70' : 'border-violet-400/40'
        } bg-linear-to-b from-violet-950/80 via-abyss to-black`}
      >
        <div className="absolute top-4 right-8 size-14 rounded-full bg-red-200/20 blur-sm" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-linear-to-t from-black/80 to-transparent" aria-hidden="true" />
        {places.map((place, figure) => {
          const spot = Math.round(place.x) as Spot
          const isReal = figure === round.start
          const lit = isReal && (phase === 'show' || picked)
          return (
            <Figure
              key={figure}
              x={place.x}
              lift={place.lift}
              lit={lit}
              blending={isReal && phase === 'blend'}
              pointed={isReal && phase === 'show'}
              faded={picked && !isReal}
              clickable={canPick}
              label={`Pick the ${SPOT_NAMES[spot]} one`}
              onPick={() => pick(spot)}
              mine={myPick?.spot === spot}
              theirs={theirPick?.spot === spot ? players[other(me)].champion : null}
              you={players[me].champion}
            />
          )
        })}
      </motion.div>
      <div className="flex h-16 w-full items-center justify-center">
        {myPick && theirPick ? (
          <RoundVersus mine={myPick} theirs={theirPick} real={real} me={me} players={players} />
        ) : (
          waitingFor && myPick && <Waiting name={waitingFor} />
        )}
      </div>
    </div>
  )
}

interface FigureProps {
  /** Spot as a number, 0–2. */
  x: number
  lift: number
  /** In full color: the real Zed when pointed out, and after the pick. */
  lit: boolean
  /** The real Zed turning into a shadow. */
  blending: boolean
  pointed: boolean
  /** A shadow after the pick: it fades away. */
  faded: boolean
  clickable: boolean
  label: string
  onPick: () => void
  mine: boolean
  /** The opponent's champion when they picked this one. */
  theirs: string | null
  you: string
}

function Figure({ x, lift, lit, blending, pointed, faded, clickable, label, onPick, mine, theirs, you }: FigureProps) {
  const style = {
    left: `${((x + 0.5) / 3) * 100}%`,
    top: `${50 + lift * LIFT * 100}%`,
    zIndex: lift > 0.05 ? 3 : lift < -0.05 ? 1 : 2,
    transform: `translate(-50%, -50%) scale(${1 + lift * 0.09})`,
  }
  return (
    <div className="absolute w-[29%] max-w-32" style={style}>
      <AnimatePresence>
        {pointed && (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: [0, -8, 0], opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ y: { duration: 0.7, repeat: Infinity }, opacity: { duration: 0.2 } }}
            className="absolute -top-9 left-1/2 flex -translate-x-1/2 flex-col items-center font-display text-sm font-black text-gold drop-shadow-[0_0_8px_rgb(200_170_110)]"
          >
            ZED
            <span className="-mt-1 text-lg leading-none">▼</span>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        type="button"
        aria-label={label}
        disabled={!clickable}
        onClick={onPick}
        whileTap={clickable ? { scale: 0.92 } : undefined}
        animate={faded ? { opacity: 0.35, scale: 0.92 } : { opacity: 1, scale: 1 }}
        className={`relative block aspect-[3/4] w-full overflow-hidden rounded-lg border-2 transition-[border-color,box-shadow] duration-500 enabled:cursor-pointer ${
          lit
            ? 'border-gold shadow-[0_0_22px_rgb(200_170_110/0.75)]'
            : mine
              ? 'border-hextech shadow-[0_0_18px_rgb(10_200_185/0.7)]'
              : 'border-violet-400/50 shadow-[0_0_16px_rgb(139_92_246/0.45)] enabled:hover:border-hextech'
        }`}
      >
        <img
          src={ZED_ART}
          alt=""
          draggable={false}
          className="size-full object-cover object-top transition-[filter] ease-in"
          style={{
            filter: lit ? 'none' : 'brightness(0.3) saturate(0.15) contrast(1.2)',
            transitionDuration: blending ? `${SHADOW_TIMING.blendMs}ms` : '300ms',
          }}
        />
        {!lit && <span className="absolute inset-0 bg-linear-to-b from-violet-700/30 via-transparent to-red-900/30" aria-hidden="true" />}
        {blending && (
          <motion.span
            initial={{ scale: 0.4, opacity: 0.9 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: SHADOW_TIMING.blendMs / 1000 }}
            className="absolute inset-0 rounded-full bg-violet-500/50 blur-md"
            aria-hidden="true"
          />
        )}
      </motion.button>
      {mine && <PickBadge champion={you} you />}
      {theirs && <PickBadge champion={theirs} you={false} />}
    </div>
  )
}

function PickBadge({ champion, you }: { champion: string; you: boolean }) {
  return (
    <motion.img
      src={championIconById(champion)}
      alt=""
      initial={{ scale: 0, y: you ? -6 : 6 }}
      animate={{ scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 16 }}
      className={`absolute left-1/2 size-8 max-w-none -translate-x-1/2 rounded-full border-2 sm:size-9 ${
        you ? '-top-5 border-hextech' : '-bottom-5 border-red-400'
      }`}
    />
  )
}

/** What happens before the pick, in one big word. */
function PhaseCall({ phase, step }: { phase: ShadowPhase; step: number }) {
  if (phase === 'show') {
    return <BigCall text="Watch Zed!" tone="plain" size="large" sub={step === 0 ? undefined : step === 1 ? 'Round 2: faster, with feints' : 'Last round: fastest'} />
  }
  if (phase === 'blend') return <BigCall text="Shadows!" tone="them" size="large" />
  return (
    <motion.img
      src={LIVING_SHADOW}
      alt=""
      animate={{ rotate: 360 }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
      className="size-12 rounded-full border-2 border-violet-400/70 opacity-80"
    />
  )
}

function PickCall({ right, missed, real }: { right: boolean; missed: boolean; real: Spot }) {
  if (right) return <BigCall text="Found him!" tone="win" size="large" />
  return <BigCall text={missed ? 'Too slow' : 'Shadow!'} tone="lose" size="large" sub={`Zed was on the ${SPOT_NAMES[real]}`} />
}

interface RoundVersusProps {
  mine: { spot: Spot | null; ms: number }
  theirs: { spot: Spot | null; ms: number }
  real: Spot
  me: Player
  players: readonly [Contestant, Contestant]
}

/** Both picks of the round side by side: found or fooled, and how fast. */
function RoundVersus({ mine, theirs, real, me, players }: RoundVersusProps) {
  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="grid w-full max-w-xs grid-cols-[1fr_auto_1fr] items-center gap-3"
      aria-live="polite"
    >
      <PickSide contestant={players[me]} you pick={mine} right={mine.spot === real} />
      <span className="font-display text-lg text-gold/60">vs</span>
      <PickSide contestant={players[other(me)]} you={false} pick={theirs} right={theirs.spot === real} />
    </motion.div>
  )
}

function PickSide({ contestant, you, pick, right }: { contestant: Contestant; you: boolean; pick: { spot: Spot | null; ms: number }; right: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${you ? 'justify-end' : 'flex-row-reverse justify-end'}`}>
      <img
        src={championIconById(contestant.champion)}
        alt={contestant.name}
        className={`size-9 rounded-full border-2 ${you ? 'border-hextech' : 'border-red-400'}`}
      />
      <div className={`flex flex-col leading-tight ${you ? 'items-end' : 'items-start'}`}>
        <span className={`font-display text-2xl font-black ${right ? 'text-gold' : 'text-red-400'}`}>{right ? '✓' : '✗'}</span>
        <span className="text-xs text-gold-light/70 tabular-nums">{pick.spot === null ? 'no pick' : `${(pick.ms / 1000).toFixed(1)} s`}</span>
      </div>
    </div>
  )
}

/** A small figure for the tutorial pictures. */
function MiniFigure({ lit, className = '' }: { lit: boolean; className?: string }) {
  return (
    <span
      className={`block aspect-[3/4] w-[28%] overflow-hidden rounded border ${lit ? 'border-gold shadow-[0_0_8px_rgb(200_170_110)]' : 'border-violet-400/60'} ${className}`}
    >
      <img
        src={ZED_ART}
        alt=""
        className="size-full object-cover object-top"
        style={{ filter: lit ? 'none' : 'brightness(0.3) saturate(0.15) contrast(1.2)' }}
      />
    </span>
  )
}

/** 1: the real Zed is pointed out. 2: the shadows swap. 3: tap the real one. */
export function ShadowsTutorialArt({ step }: TutorialArtProps) {
  const backdrop = 'relative flex size-full items-center justify-center gap-[4%] bg-linear-to-b from-violet-950/80 to-black'
  if (step === 0) {
    return (
      <div className={backdrop}>
        <MiniFigure lit={false} />
        <span className="relative block w-[28%]">
          <motion.span
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="absolute -top-4 left-1/2 -translate-x-1/2 text-xs leading-none text-gold sm:-top-6 sm:text-base"
          >
            ▼
          </motion.span>
          <MiniFigure lit className="w-full" />
        </span>
        <MiniFigure lit={false} />
      </div>
    )
  }
  if (step === 1) {
    return (
      <div className={backdrop}>
        <motion.span
          animate={{ x: ['0%', '120%', '120%', '0%', '0%'], y: ['0%', '-30%', '0%', '30%', '0%'] }}
          transition={{ duration: 2.2, repeat: Infinity, times: [0, 0.25, 0.5, 0.75, 1], ease: 'easeInOut' }}
          className="relative z-10 block w-[28%]"
        >
          <MiniFigure lit={false} className="w-full" />
        </motion.span>
        <motion.span
          animate={{ x: ['0%', '-120%', '-120%', '0%', '0%'], y: ['0%', '30%', '0%', '-30%', '0%'] }}
          transition={{ duration: 2.2, repeat: Infinity, times: [0, 0.25, 0.5, 0.75, 1], ease: 'easeInOut' }}
          className="relative block w-[28%]"
        >
          <MiniFigure lit={false} className="w-full" />
        </motion.span>
        <MiniFigure lit={false} />
      </div>
    )
  }
  return (
    <div className={backdrop}>
      <MiniFigure lit={false} className="opacity-40" />
      <MiniFigure lit={false} className="opacity-40" />
      <span className="relative block w-[28%]">
        <MiniFigure lit className="w-full" />
        <motion.span
          animate={{ y: [6, 0, 6], scale: [1, 0.85, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="absolute -bottom-2 left-1/2 -translate-x-1/4 text-lg sm:text-2xl"
          aria-hidden="true"
        >
          👆
        </motion.span>
      </span>
    </div>
  )
}
