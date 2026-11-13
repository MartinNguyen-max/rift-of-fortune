import { motion } from 'framer-motion'
import { useMemo, type ReactNode } from 'react'
import { spellIconUrl } from '../../data'
import { barOfStep, markerAt, NO_PRESS, ULT, ULT_ZONES, ultBars, ultScoreOfMove, ultScores, type UltBar } from '../../game/minigames/ult'
import { other, type Player } from '../../game/minigames/versus'
import { GetReady } from './GetReady'
import { championIconById } from './miniGameArt'
import { BigCall, ContestantTag, Waiting } from './parts'
import { useShownWhen } from './timing'
import type { Contestant, MiniGameViewProps, TutorialArtProps } from './types'
import { sum, useStepFlow, useTimedPress } from './stepFlow'
import { pressMarker, ULT_CALLS, ultBand } from './ultScreen'

/** Malphite's ult, Unstoppable Force. */
const MALPHITE_R = spellIconUrl('UFSlash.png')
/** Time from your press until the opponent's score shows. */
const REVEAL_MS = 900
/** How long a finished bar stays up before the next one. */
const BETWEEN_BARS_MS = 3400
/** How long the last bar's result shows before Victory or Defeat. */
const LAST_BAR_MS = 3000

const percent = (share: number) => `${share * 100}%`

/** Bands from wide to narrow, so the brightest (perfect) one is drawn on top. */
const ZONE_BANDS = [
  { halfWidth: ULT_ZONES.good, className: 'bg-gold/20' },
  { halfWidth: ULT_ZONES.great, className: 'bg-gold/45' },
  { halfWidth: ULT_ZONES.perfect, className: 'bg-gold' },
] as const

/** Malphite vs Amumu: stop the racing marker in the gold zone. Solo adds up three bars, Multiplayer plays one. */
export function UltGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const bars = ultBars(setup)
  const flow = useStepFlow({ moves, me, steps: bars, sendMove, revealMs: REVEAL_MS, pauseMs: BETWEEN_BARS_MS })
  useShownWhen(flow.over, onShown, LAST_BAR_MS)

  const { step } = flow
  const bar = useMemo(() => barOfStep(setup, step), [setup, step])
  const scores = useMemo(() => ultScores(moves, setup), [moves, setup])
  const myScore = flow.myMove === undefined ? undefined : ultScoreOfMove(bar, flow.myMove)
  const theirScore = flow.theirMove === undefined ? undefined : ultScoreOfMove(bar, flow.theirMove)
  const mine = [...scores[me].slice(0, step), ...(myScore === undefined ? [] : [myScore])]
  const theirs = [...scores[them].slice(0, step), ...(theirScore === undefined ? [] : [theirScore])]

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ContestantTag contestant={players[me]} you value={`${sum(mine)}`} />
        {bars > 1 ? (
          <BarDots bars={bars} current={step} mine={mine} theirs={theirs} />
        ) : (
          <span className="font-display text-lg text-gold/60">vs</span>
        )}
        <ContestantTag contestant={players[them]} you={false} value={`${sum(theirs)}`} />
      </div>
      <UltRound
        key={step}
        bar={bar}
        myMove={flow.myMove}
        theirMove={flow.theirMove}
        waitingFor={flow.waiting ? players[them].name : null}
        me={me}
        players={players}
        onPress={flow.send}
      />
      <p className="text-xs text-gold-light/60">Tap, click or Space</p>
    </div>
  )
}

/** One dot per bar: gold when you took it, red when they did, a ring on the bar being played. */
function BarDots({ bars, current, mine, theirs }: { bars: number; current: number; mine: number[]; theirs: number[] }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Bar ${current + 1} of ${bars}`}>
      {Array.from({ length: bars }, (_, index) => {
        const a = mine[index]
        const b = theirs[index]
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

interface UltRoundProps {
  bar: UltBar
  /** Your press for this bar once it is in. */
  myMove: number | undefined
  /** The opponent's press, once it may be shown. */
  theirMove: number | undefined
  /** The opponent's name while their press hasn't arrived. */
  waitingFor: string | null
  me: Player
  players: readonly [Contestant, Contestant]
  onPress: (ms: number) => void
}

/** One bar: 3-2-1, the marker races, you press. Mounted fresh per bar so its clock starts at 0. */
function UltRound({ bar, myMove, theirMove, waitingFor, me, players, onPress }: UltRoundProps) {
  const timed = useTimedPress({ move: myMove, limitMs: ULT.seconds * 1000, missed: NO_PRESS, onPress })
  const pressed = myMove !== undefined
  const elapsed = pressed ? Math.min(myMove, NO_PRESS) / 1000 : timed.running ? timed.seconds : 0
  const myMarker = pressed ? pressMarker(bar, myMove) : markerAt(bar, elapsed)
  const theirMarker = theirMove === undefined ? null : pressMarker(bar, theirMove)

  return (
    <div className="flex w-full touch-manipulation flex-col items-center gap-3 select-none" onPointerDown={timed.press}>
      <motion.div
        animate={pressed ? { x: [0, -9, 9, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className={`w-full cursor-pointer overflow-hidden rounded-lg border-2 bg-linear-to-b from-stone-500/30 via-stone-800/40 to-abyss px-7 pt-2 pb-3 ${
          timed.running ? 'border-hextech/60' : 'border-gold/40'
        }`}
      >
        <div className="flex h-28 items-center justify-center">
          {pressed ? <PressCall bar={bar} move={myMove} /> : !timed.started && <GetReady onGo={timed.start} />}
        </div>
        <div className="relative mt-12 mb-11 h-14 sm:h-16">
          <div className="absolute inset-0 overflow-hidden rounded-md border-2 border-gold/60 bg-abyss/90">
            {ZONE_BANDS.map(({ halfWidth, className }) => (
              <div
                key={halfWidth}
                className={`absolute inset-y-0 ${className}`}
                style={{ left: percent(bar.zoneCenter - halfWidth), width: percent(halfWidth * 2) }}
              />
            ))}
            <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/90" style={{ left: percent(bar.zoneCenter) }} />
          </div>
          {myMarker !== null && <SlamMarker position={myMarker} slammed={pressed} />}
          {theirMarker !== null && <TheirMarker position={theirMarker} champion={players[other(me)].champion} />}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-abyss/80">
          <div className="h-full rounded-full bg-red-400" style={{ width: percent(Math.max(0, 1 - elapsed / ULT.seconds)) }} />
        </div>
      </motion.div>
      <div className="flex h-28 w-full items-center justify-center">
        {!pressed ? (
          <UltButton active={timed.running} onPress={timed.press} />
        ) : theirMove !== undefined ? (
          <BarVersus bar={bar} myMove={myMove} theirMove={theirMove} me={me} players={players} />
        ) : (
          waitingFor && <Waiting name={waitingFor} />
        )}
      </div>
    </div>
  )
}

/** Your marker with Malphite's ult riding on it; on a press it slams into the bar. */
function SlamMarker({ position, slammed }: { position: number; slammed: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-y-0" style={{ left: percent(position) }}>
      <div className="absolute inset-y-0 left-0 w-1.5 -translate-x-1/2 rounded-full bg-hextech shadow-[0_0_12px_rgb(10_200_185)]" />
      <motion.img
        src={MALPHITE_R}
        alt=""
        draggable={false}
        animate={slammed ? { y: [0, -16, 26], scale: [1, 1.2, 1.1] } : { y: 0, scale: 1 }}
        transition={{ duration: 0.3, times: [0, 0.45, 1], ease: 'easeIn' }}
        className="absolute -top-12 left-0 size-10 max-w-none -translate-x-1/2 rounded-md border-2 border-hextech shadow-lg shadow-black/60"
      />
      {slammed && (
        <motion.span
          initial={{ scale: 0.2, opacity: 1 }}
          animate={{ scale: 2.8, opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.28 }}
          className="absolute top-1/2 left-0 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-gold"
          aria-hidden="true"
        />
      )}
    </div>
  )
}

/** The opponent's press: a red marker with their champion bursting up from below. */
function TheirMarker({ position, champion }: { position: number; champion: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pointer-events-none absolute inset-y-0"
      style={{ left: percent(position) }}
    >
      <div className="absolute inset-y-0 left-0 w-1.5 -translate-x-1/2 rounded-full bg-red-400 shadow-[0_0_12px_rgb(248_113_113)]" />
      <motion.img
        src={championIconById(champion)}
        alt=""
        initial={{ y: 26, scale: 1.4 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        className="absolute -bottom-10 left-0 size-9 max-w-none -translate-x-1/2 rounded-full border-2 border-red-400"
      />
    </motion.div>
  )
}

/** Your result, huge: the band you hit and the score. */
function PressCall({ bar, move }: { bar: UltBar; move: number }) {
  const score = ultScoreOfMove(bar, move)
  const { text, tone } = ULT_CALLS[ultBand(bar, move)]
  return (
    <div className="flex flex-col items-center gap-1">
      <BigCall text={text} tone={tone} size="large" />
      <motion.span
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 12 }}
        className={`font-display text-5xl font-black tabular-nums ${score > 0 ? 'text-hextech' : 'text-red-500'}`}
      >
        {score}
      </motion.span>
    </div>
  )
}

function UltButton({ active, onPress }: { active: boolean; onPress: () => void }) {
  return (
    <motion.button
      type="button"
      aria-label="Ult"
      disabled={!active}
      onClick={onPress}
      whileTap={{ scale: 0.88 }}
      animate={active ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={active ? { duration: 0.8, repeat: Infinity } : { duration: 0.2 }}
      className="relative flex size-28 touch-manipulation items-center justify-center overflow-hidden rounded-full border-4 border-hextech bg-abyss shadow-lg shadow-cyan-500/40 disabled:opacity-40"
    >
      <img src={MALPHITE_R} alt="" draggable={false} className="absolute inset-0 size-full object-cover opacity-80" />
      <span className="relative font-display text-3xl font-black text-white drop-shadow-[0_2px_4px_black]">ULT</span>
    </motion.button>
  )
}

interface BarVersusProps {
  bar: UltBar
  myMove: number
  theirMove: number
  me: Player
  players: readonly [Contestant, Contestant]
}

/** Both scores for the bar side by side, the higher one in gold. */
function BarVersus({ bar, myMove, theirMove, me, players }: BarVersusProps) {
  const mine = ultScoreOfMove(bar, myMove)
  const theirs = ultScoreOfMove(bar, theirMove)
  return (
    <motion.div
      initial={{ y: 14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="grid w-full max-w-xs grid-cols-[1fr_auto_1fr] items-center gap-3"
      aria-live="polite"
    >
      <VersusSide contestant={players[me]} you score={mine} best={mine > theirs} />
      <span className="font-display text-lg text-gold/60">vs</span>
      <VersusSide contestant={players[other(me)]} you={false} score={theirs} best={theirs > mine} />
    </motion.div>
  )
}

function VersusSide({ contestant, you, score, best }: { contestant: Contestant; you: boolean; score: number; best: boolean }) {
  const color = best ? 'text-gold' : you ? 'text-hextech' : 'text-red-400'
  return (
    <div className={`flex items-center gap-2 ${you ? 'justify-end' : 'flex-row-reverse justify-end'}`}>
      <img
        src={championIconById(contestant.champion)}
        alt={contestant.name}
        className={`size-10 rounded-full border-2 ${you ? 'border-hextech' : 'border-red-400'}`}
      />
      <span className={`font-display text-4xl font-black tabular-nums ${color}`}>{score}</span>
    </div>
  )
}

/** A mini bar with the gold zone and a center line. */
function MiniBar({ children }: { children?: ReactNode }) {
  return (
    <div className="relative h-[22%] w-[84%]">
      <div className="absolute inset-0 overflow-hidden rounded border-2 border-gold/60 bg-abyss">
        <div className="absolute inset-y-0 left-[38%] w-[24%] bg-gold/30" />
        <div className="absolute inset-y-0 left-[46%] w-[8%] bg-gold" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-white" />
      </div>
      {children}
    </div>
  )
}

/** 1: the marker sweeps. 2: tap ULT in the zone. 3: center = 100. */
export function UltTutorialArt({ step }: TutorialArtProps) {
  if (step === 0) {
    return (
      <div className="flex size-full items-center justify-center bg-linear-to-b from-stone-500/30 to-abyss">
        <MiniBar>
          <motion.div
            animate={{ left: ['4%', '96%', '4%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-y-0"
          >
            <span className="absolute inset-y-0 left-0 w-1 -translate-x-1/2 rounded-full bg-hextech shadow-[0_0_8px_rgb(10_200_185)]" />
            <img src={MALPHITE_R} alt="" className="absolute bottom-full left-0 mb-1 size-6 max-w-none -translate-x-1/2 rounded border border-hextech sm:size-9" />
          </motion.div>
        </MiniBar>
      </div>
    )
  }
  if (step === 1) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-[10%] bg-linear-to-b from-stone-500/30 to-abyss">
        <MiniBar>
          <span className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 rounded-full bg-hextech shadow-[0_0_8px_rgb(10_200_185)]" />
        </MiniBar>
        <div className="relative flex size-[42%] items-center justify-center">
          <motion.span
            animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
            transition={{ duration: 1.1, repeat: Infinity }}
            className="absolute inset-0 rounded-full border-2 border-hextech"
          />
          <motion.span
            animate={{ scale: [1, 0.86, 1] }}
            transition={{ duration: 1.1, repeat: Infinity }}
            className="relative flex size-full items-center justify-center overflow-hidden rounded-full border-2 border-hextech"
          >
            <img src={MALPHITE_R} alt="" className="absolute inset-0 size-full object-cover" />
            <span className="relative font-display text-[10px] font-black text-white drop-shadow-[0_1px_2px_black] sm:text-base">
              ULT
            </span>
          </motion.span>
        </div>
      </div>
    )
  }
  return (
    <div className="flex size-full flex-col items-center justify-center gap-[8%] bg-linear-to-b from-stone-500/30 to-abyss">
      <motion.span
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="font-display text-2xl font-black text-gold drop-shadow-[0_0_10px_rgb(200_170_110/0.8)] sm:text-4xl"
      >
        100
      </motion.span>
      <MiniBar>
        <span className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 rounded-full bg-hextech shadow-[0_0_8px_rgb(10_200_185)]" />
      </MiniBar>
    </div>
  )
}
