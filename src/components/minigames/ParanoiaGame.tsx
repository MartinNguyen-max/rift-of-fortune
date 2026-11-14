import { motion } from 'framer-motion'
import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import { spellIconUrl, summonersRiftMapUrl } from '../../data'
import {
  callMove,
  callOpensMs,
  flightOfStep,
  NO_CALL,
  PARANOIA_TIMING,
  paranoiaCalls,
  paranoiaRoundCount,
  readCall,
  type Flight,
} from '../../game/minigames/paranoia'
import { LANE_NAMES, LANE_SPOTS, type Lane, type MapPoint } from '../../game/minigames/riftLanes'
import { other, type Player } from '../../game/minigames/versus'
import { LaneMap, LaneToken } from './LaneMap'
import { LANE_SIDES, placeAt, useLaneKeys } from './laneScreen'
import { championIconById } from './miniGameArt'
import { paranoiaView, type ParanoiaPhase } from './paranoiaScreen'
import { BigCall, ChoiceTimer, ContestantTag, Waiting } from './parts'
import { useStepFlow } from './stepFlow'
import { useShownWhen } from './timing'
import type { Contestant, MiniGameViewProps, TutorialArtProps } from './types'
import { useStopwatch } from './useStopwatch'

const NOCTURNE = 'Nocturne'
const PARANOIA_ICON = spellIconUrl('NocturneParanoia.png')
/** Time from your call until the opponent's call shows. */
const REVEAL_MS = 900
/** How long the last round's result shows before Victory or Defeat. */
const LAST_ROUND_MS = 2800

/** By round: right or wrong, from your side. */
type RoundMark = 'right' | 'wrong'

/** Lights out: Nocturne flickers through the dark toward a lane. Call it before he lands. Three rounds, each darker. */
export function ParanoiaGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const rounds = paranoiaRoundCount()
  const flow = useStepFlow({ moves, me, steps: rounds, sendMove, revealMs: REVEAL_MS, pauseMs: PARANOIA_TIMING.betweenMs })
  useShownWhen(flow.over, onShown, LAST_ROUND_MS)

  const { step } = flow
  const flight = useMemo(() => flightOfStep(setup, step), [setup, step])
  const calls = useMemo(() => paranoiaCalls(moves, setup), [moves, setup])
  const rightNow = (move: number | undefined) => (move === undefined ? [] : [readCall(move).lane === flight.lane])
  // Rounds before this one, and this one once your call (or theirs, once shown) is in.
  const mine = [...calls[me].slice(0, step).map(({ right }) => right), ...rightNow(flow.myMove)]
  const theirs = [...calls[them].slice(0, step).map(({ right }) => right), ...rightNow(flow.theirMove)]
  const count = (marks: readonly boolean[]) => marks.filter(Boolean).length

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ContestantTag contestant={players[me]} you value={`${count(mine)}`} />
        <RoundDots rounds={rounds} current={step} marks={mine.map((right): RoundMark => (right ? 'right' : 'wrong'))} />
        <ContestantTag contestant={players[them]} you={false} value={`${count(theirs)}`} />
      </div>
      <ParanoiaRound
        key={step}
        flight={flight}
        step={step}
        myMove={flow.myMove}
        theirMove={flow.theirMove}
        waitingFor={flow.waiting ? players[them].name : null}
        me={me}
        players={players}
        onCall={flow.send}
      />
      <p className="text-center text-xs text-gold-light/60">Call his lane when the flickers stop: tap it, or press 1, 2, 3. Most right calls win, then the fastest.</p>
    </div>
  )
}

const DOT_COLORS: Record<RoundMark, string> = { right: 'border-gold bg-gold', wrong: 'border-red-500 bg-red-500/40' }

function RoundDots({ rounds, current, marks }: { rounds: number; current: number; marks: readonly RoundMark[] }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Round ${current + 1} of ${rounds}`}>
      {Array.from({ length: rounds }, (_, index) => {
        const mark = marks[index]
        const color = mark ? DOT_COLORS[mark] : index === current ? 'border-hextech' : 'border-gold/40'
        return <span key={index} className={`size-3.5 rounded-full border-2 ${color}`} />
      })}
    </div>
  )
}

interface ParanoiaRoundProps {
  flight: Flight
  step: number
  myMove: number | undefined
  theirMove: number | undefined
  waitingFor: string | null
  me: Player
  players: readonly [Contestant, Contestant]
  onCall: (move: number) => void
}

/** One round: the lights go out, Nocturne flickers toward a lane, you call it. Mounted fresh per round. */
function ParanoiaRound({ flight, step, myMove, theirMove, waitingFor, me, players, onCall }: ParanoiaRoundProps) {
  const called = myMove !== undefined
  const { seconds, read } = useStopwatch(!called)
  const view = called ? { phase: 'call' as const, flicker: null } : paranoiaView(flight, step, seconds * 1000)
  const opensAt = callOpensMs(flight, step)
  const canCall = view.phase === 'call' && !called

  const fired = useRef(false)
  const fire = useCallback(
    (move: number) => {
      if (fired.current) return
      fired.current = true
      onCall(move)
    },
    [onCall],
  )
  const call = useCallback((lane: Lane) => fire(callMove(lane, read() * 1000 - opensAt)), [fire, read, opensAt])
  useLaneKeys(call, canCall)

  const mine = myMove === undefined ? null : readCall(myMove)
  const theirs = theirMove === undefined ? null : readCall(theirMove)
  const right = mine !== null && mine.lane === flight.lane
  const flicker = view.flicker === null ? undefined : flight.flickers[view.flicker]

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex h-24 w-full items-center justify-center">
        {mine ? (
          <BigCall
            text={right ? 'RIGHT!' : mine.lane === null ? 'TOO SLOW!' : 'WRONG!'}
            tone={right ? 'win' : 'lose'}
            size="large"
            sub={right ? `${(mine.ms / 1000).toFixed(2)} s` : `He hit ${LANE_NAMES[flight.lane]}${flight.fake !== null ? ' (a fake-out!)' : ''}`}
          />
        ) : canCall ? (
          <ChoiceTimer seconds={PARANOIA_TIMING.pickMs / 1000} onTimeout={() => fire(NO_CALL)} label="Which lane?" />
        ) : (
          <PhaseCall phase={view.phase} step={step} />
        )}
      </div>
      <LaneMap dark={!mine} onPick={canCall ? call : null} pickVerb="Call" frame={mine ? (right ? 'win' : 'lose') : null}>
        {flicker && <Flicker key={view.flicker} at={flicker} ms={flight.flickerMs} />}
        {mine && <FlightPath flight={flight} />}
        {mine && <Landed lane={flight.lane} />}
        {mine?.lane != null && <CallToken lane={mine.lane} champion={players[me].champion} you />}
        {theirs?.lane != null && <CallToken lane={theirs.lane} champion={players[other(me)].champion} you={false} />}
      </LaneMap>
      <div className="h-5">{waitingFor && <Waiting name={waitingFor} />}</div>
    </div>
  )
}

function PhaseCall({ phase, step }: { phase: ParanoiaPhase; step: number }) {
  if (phase === 'dark') {
    return (
      <motion.div initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2">
        <img src={PARANOIA_ICON} alt="" className="size-10 rounded-md border border-red-500/70" />
        <div className="flex flex-col text-left">
          <span className="font-display text-2xl leading-none font-black text-red-400">LIGHTS OUT</span>
          <span className="text-xs text-gold-light/70">{step === 0 ? 'Watch the dark. Nocturne is coming.' : `Round ${step + 1}: darker`}</span>
        </div>
      </motion.div>
    )
  }
  return (
    <motion.span
      animate={{ opacity: [0.4, 1, 0.4] }}
      transition={{ duration: 0.9, repeat: Infinity }}
      className="font-display text-xl font-black tracking-widest text-gold-light/80 uppercase"
    >
      Watch…
    </motion.span>
  )
}

/** Nocturne, seen for an instant. */
function Flicker({ at, ms }: { at: MapPoint; ms: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1, 1, 1.1] }}
      transition={{ duration: ms / 1000, times: [0, 0.15, 0.75, 1] }}
      style={placeAt(at)}
      className="pointer-events-none absolute z-10 w-[13%] -translate-x-1/2 -translate-y-1/2"
    >
      <img
        src={championIconById(NOCTURNE)}
        alt=""
        className="aspect-square w-full rounded-full border-2 border-red-500 shadow-[0_0_20px_rgb(239_68_68/0.9)] brightness-75"
      />
    </motion.div>
  )
}

/** After the call: his whole way through the dark, with the spots he was seen at. */
function FlightPath({ flight }: { flight: Flight }) {
  const points = flight.path.map(({ x, y }) => `${x},${y}`).join(' ')
  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 z-0 size-full" aria-hidden="true">
      <motion.polyline
        points={points}
        fill="none"
        stroke="rgb(248 113 113)"
        strokeWidth="1.2"
        strokeDasharray="3 2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6 }}
      />
      {flight.flickers.map(({ x, y }, index) => (
        <circle key={index} cx={x} cy={y} r="1.6" fill="rgb(248 113 113)" opacity="0.8" />
      ))}
    </svg>
  )
}

/** Nocturne lands in his lane. */
function Landed({ lane }: { lane: Lane }) {
  return <LaneToken champion={NOCTURNE} at={LANE_SPOTS[lane]} you={false} size="large" drop label="Nocturne" />
}

/** Where a player called: their champion beside the lane they picked (yours and theirs on either side). */
function CallToken({ lane, champion, you }: { lane: Lane; champion: string; you: boolean }) {
  return <LaneToken champion={champion} at={LANE_SIDES[lane][you ? 0 : 1]} you={you} label={you ? 'You' : 'Them'} />
}

// ── Tutorial ─────────

function DarkMap({ children }: { children: ReactNode }) {
  return (
    <div className="relative size-full bg-black">
      <img src={summonersRiftMapUrl} alt="" className="absolute inset-0 size-full object-cover brightness-[0.2]" />
      {[0, 1, 2].map((lane) => (
        <span
          key={lane}
          style={{ left: `${18 + lane * 32}%`, top: `${18 + lane * 32}%` }}
          className="absolute size-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/30"
        />
      ))}
      {children}
    </div>
  )
}

const nocturneIcon = <img src={championIconById(NOCTURNE)} alt="" className="aspect-square w-full rounded-full border-2 border-red-500 brightness-75" />

/** 1: Nocturne flickers in the dark. 2: he heads for one lane and turns. 3: tap his lane, fast. */
export function ParanoiaTutorialArt({ step }: TutorialArtProps) {
  if (step === 0) {
    return (
      <DarkMap>
        <motion.span
          animate={{ opacity: [0, 1, 0, 0, 1, 0, 0] }}
          transition={{ duration: 2, repeat: Infinity, times: [0, 0.08, 0.16, 0.5, 0.58, 0.66, 1] }}
          style={{ left: '70%', top: '32%' }}
          className="absolute w-[28%] -translate-x-1/2 -translate-y-1/2"
        >
          {nocturneIcon}
        </motion.span>
      </DarkMap>
    )
  }
  if (step === 1) {
    return (
      <DarkMap>
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
          <polyline points="80,20 66,62 18,18" fill="none" stroke="rgb(248 113 113)" strokeWidth="3" strokeDasharray="6 4" />
        </svg>
        <motion.span
          animate={{ left: ['80%', '66%', '30%'], top: ['20%', '62%', '30%'], opacity: [1, 1, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
          className="absolute w-[24%] -translate-x-1/2 -translate-y-1/2"
        >
          {nocturneIcon}
        </motion.span>
      </DarkMap>
    )
  }
  return (
    <DarkMap>
      <motion.span
        animate={{ boxShadow: ['0 0 0 rgb(10 200 185 / 0)', '0 0 18px rgb(10 200 185 / 0.9)', '0 0 0 rgb(10 200 185 / 0)'] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        style={{ left: '18%', top: '18%' }}
        className="absolute size-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-hextech"
      />
      <motion.span
        animate={{ scale: [1, 0.8, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        style={{ left: '34%', top: '34%' }}
        className="absolute -translate-x-1/2 -translate-y-1/2 text-2xl sm:text-4xl"
      >
        👆
      </motion.span>
      <span style={{ left: '66%', top: '78%' }} className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-gold/90 px-1 text-[10px] font-black text-abyss sm:text-xs">
        0.8 s
      </span>
    </DarkMap>
  )
}
