import { motion } from 'framer-motion'
import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import { spellIconUrl, summonersRiftMapUrl } from '../../data'
import { MINI_GAMES } from '../../game/minigames/catalog'
import {
  DESTINY_SECONDS,
  destinyHalves,
  destinyPoints,
  destinyResults,
  gankerOf,
  halfScorer,
  NO_GUESS,
  readGank,
  TIMEOUT_GANK,
  type DestinyHalf,
} from '../../game/minigames/destiny'
import { LANE_NAMES, LANE_SPOTS, type Lane } from '../../game/minigames/riftLanes'
import { other, type BothMoves, type GameSetup, type Player } from '../../game/minigames/versus'
import { DESTINY_BEAT, destinyCall, destinyPhase, useDestinyReveal, type DestinyBeat, type DestinyPhase } from './destinyScreen'
import { LaneMap, LaneToken } from './LaneMap'
import { LANE_SIDES, useLaneKeys } from './laneScreen'
import { championIconById } from './miniGameArt'
import { BigCall, ChoiceTimer, ContestantTag, Waiting } from './parts'
import { useShownWhen } from './timing'
import type { Contestant, MiniGameViewProps, TutorialArtProps } from './types'

const TWISTED_FATE = MINI_GAMES.destiny.champion
const NOCTURNE = MINI_GAMES.destiny.botChampion
/** Each ganker's ult: Destiny for Twisted Fate, Paranoia for Nocturne. */
const ULT_ICONS: Readonly<Record<string, string>> = {
  [TWISTED_FATE]: spellIconUrl('Destiny.png'),
  [NOCTURNE]: spellIconUrl('NocturneParanoia.png'),
}
/** How long the last call stays up before Victory or Defeat covers it. */
const LAST_CALL_HOLD_MS = 2400

type Players = readonly [Contestant, Contestant]

/** One player ganks all game, the other guesses: 5 ganks, a lane picked in secret each time. */
export function DestinyGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const halves = destinyHalves()
  const results = useMemo(() => destinyResults(moves, setup), [moves, setup])
  const { half, beat, revealing } = useDestinyReveal(results.length)
  const current = revealing ? results[half] : undefined
  const called = current !== undefined && beat >= DESTINY_BEAT.called
  const scored = results.slice(0, called ? half + 1 : half)
  const points = destinyPoints(scored)
  useShownWhen(called && half === halves - 1, onShown, LAST_CALL_HOLD_MS)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ScoreTag contestant={players[me]} you points={points[me]} />
        <HalfDots halves={halves} scored={scored} current={half} me={me} />
        <ScoreTag contestant={players[them]} you={false} points={points[them]} />
      </div>
      <HalfView
        key={half}
        half={half}
        setup={setup}
        me={me}
        moves={moves}
        revealing={revealing}
        beat={beat}
        result={current}
        players={players}
        sendMove={sendMove}
      />
      <p className="hidden text-sm text-gold-light/60 sm:block">Tap a lane, or press 1, 2, 3</p>
    </div>
  )
}

interface HalfViewProps {
  half: number
  setup: GameSetup
  me: Player
  moves: BothMoves
  revealing: boolean
  beat: DestinyBeat
  result: DestinyHalf | undefined
  players: Players
  sendMove: (step: number, value: number) => void
}

/** One half: the choice while it is played, then its reveal. Mounted fresh per half. */
function HalfView({ half, setup, me, moves, revealing, beat, result, players, sendMove }: HalfViewProps) {
  const phase = destinyPhase(half, me, moves, setup, revealing)
  const ganker = gankerOf(setup)
  const gankerArt = players[ganker].champion
  const guesserArt = players[other(ganker)].champion
  const them = other(me)

  const sent = useRef(false)
  const send = useCallback(
    (move: number) => {
      if (sent.current) return
      sent.current = true
      sendMove(half, move)
    },
    [half, sendMove],
  )
  const picking = phase === 'gank' || phase === 'guess'
  useLaneKeys(send, picking)

  const myGank = ganker === me && moves[me][half] !== undefined ? readGank(moves[me][half]) : null
  const call = result && beat >= DESTINY_BEAT.called ? destinyCall(result, me, [players[0].name, players[1].name]) : null
  const landed = result !== undefined && beat >= DESTINY_BEAT.landed
  // Nocturne's Paranoia: the lights stay out until he lands.
  const dark = gankerArt === NOCTURNE && !landed
  const variant = setup.variant

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex min-h-14 w-full items-center justify-center">
        {phase === 'gank' && <ChoiceTimer key={`gank-${half}`} seconds={DESTINY_SECONDS.gank[variant]} label="Gank" onTimeout={() => send(TIMEOUT_GANK)} />}
        {phase === 'guess' && <ChoiceTimer key={`guess-${half}`} seconds={DESTINY_SECONDS.guess[variant]} label="Guess" onTimeout={() => send(NO_GUESS)} />}
        {(phase === 'ganked' || phase === 'waitGank') && <Waiting name={players[them].name} />}
      </div>
      <div className="flex min-h-16 w-full items-center justify-center text-center">
        {call ? <BigCall text={call.text} tone={call.tone} sub={call.sub} size="large" /> : <Prompt phase={phase} ganker={gankerArt} myGank={myGank} them={players[them].name} />}
      </div>
      <LaneMap dark={dark} onPick={picking ? send : null} pickVerb={phase === 'gank' ? 'Gank' : 'Guess'} frame={call?.tone ?? null}>
        {myGank !== null && !revealing && <LaneToken champion={gankerArt} at={LANE_SPOTS[myGank]} you label="Gank" />}
        {result && beat >= DESTINY_BEAT.guess && result.guess !== null && (
          <LaneToken champion={guesserArt} at={guessSpot(result)} you={other(result.ganker) === me} label="Guess" />
        )}
        {landed && <LaneToken champion={gankerArt} at={LANE_SPOTS[result.lane]} you={result.ganker === me} size="large" drop label="Gank" />}
        {landed && <Clash result={result} />}
      </LaneMap>
    </div>
  )
}

/** The guess stands in its lane, or beside it when the ganker lands in the same one. */
function guessSpot({ guess, lane }: DestinyHalf) {
  return guess === lane ? LANE_SIDES[lane][1] : LANE_SPOTS[guess ?? lane]
}

interface PromptProps {
  phase: DestinyPhase
  /** The champion ganking this half. */
  ganker: string
  myGank: Lane | null
  them: string
}

/** One short line saying what to do now. */
function Prompt({ phase, ganker, myGank, them }: PromptProps) {
  const line = (main: string, sub?: string) => (
    <div className="flex items-center gap-2">
      {ULT_ICONS[ganker] && <img src={ULT_ICONS[ganker]} alt="" className="size-9 rounded-md border border-gold/60" />}
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-display text-lg leading-tight font-black text-gold-light">{main}</span>
        {sub && <span className="text-xs text-gold-light/70">{sub}</span>}
      </div>
    </div>
  )
  if (phase === 'gank') return line('Pick a lane to gank', 'Gets through: +1 · they guess it: +2 them')
  if (phase === 'ganked' && myGank !== null) return line(`Ganking ${LANE_NAMES[myGank]}…`, 'Will they guess it?')
  if (phase === 'waitGank') return line(`${them} picks a lane to gank`, 'Get ready to guess')
  if (phase === 'guess') return line('Which lane are they ganking?', 'Right guess: +2 · wrong: +1 them')
  return null
}

/** A burst where the gank lands: gold when it got through, red when it was countered. */
function Clash({ result }: { result: DestinyHalf }) {
  const spot = LANE_SPOTS[result.lane]
  return (
    <motion.span
      initial={{ scale: 0.2, opacity: 1 }}
      animate={{ scale: 2.4, opacity: 0 }}
      transition={{ duration: 0.7 }}
      style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
      className={`pointer-events-none absolute z-0 size-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border-4 ${
        result.countered ? 'border-red-500' : 'border-gold'
      }`}
    />
  )
}

function ScoreTag({ contestant, you, points }: { contestant: Contestant; you: boolean; points: number }) {
  return (
    <motion.div
      key={points}
      className={`min-w-0 ${you ? 'origin-left' : 'origin-right'}`}
      initial={points > 0 ? { scale: 1.35 } : false}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 12 }}
    >
      <ContestantTag contestant={contestant} you={you} value={`${points}`} />
    </motion.div>
  )
}

/** One dot per half: gold for your points, red for theirs, a ring on the half being played. */
function HalfDots({ halves, scored, current, me }: { halves: number; scored: readonly DestinyHalf[]; current: number; me: Player }) {
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={`Round ${current + 1} of ${halves}`}>
      {Array.from({ length: halves }, (_, index) => {
        const result = scored[index]
        const color = result
          ? halfScorer(result) === me
            ? 'border-gold bg-gold'
            : 'border-red-400 bg-red-400'
          : index === current
            ? 'border-gold-light'
            : 'border-gold/40'
        return <span key={index} className={`size-3 rounded-full border-2 ${color}`} />
      })}
    </div>
  )
}

// ── Tutorial ─────────

const MINI_SPOTS = [
  { left: '18%', top: '18%' },
  { left: '50%', top: '50%' },
  { left: '82%', top: '82%' },
] as const

function MiniMap({ children }: { children: ReactNode }) {
  return (
    <div className="relative size-full">
      <img src={summonersRiftMapUrl} alt="" className="absolute inset-0 size-full object-cover opacity-60" />
      {MINI_SPOTS.map((spot, lane) => (
        <span key={lane} style={spot} className="absolute size-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/50" />
      ))}
      {children}
    </div>
  )
}

const miniIcon = (champion: string, ring: string) => (
  <img src={championIconById(champion)} alt="" className={`aspect-square w-full rounded-full border-2 ${ring}`} />
)

/** 1: the ganker picks a lane. 2: the other one guesses. 3: a right guess +2, else the gank +1. */
export function DestinyTutorialArt({ step }: TutorialArtProps) {
  if (step === 0) {
    return (
      <MiniMap>
        <motion.span
          animate={{ left: ['50%', '18%', '18%', '50%'], top: ['50%', '18%', '18%', '50%'] }}
          transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.3, 0.8, 1] }}
          className="absolute w-[30%] -translate-x-1/2 -translate-y-1/2"
        >
          {miniIcon(TWISTED_FATE, 'border-hextech')}
        </motion.span>
      </MiniMap>
    )
  }
  if (step === 1) {
    return (
      <MiniMap>
        <span style={{ left: '82%', top: '82%' }} className="absolute w-[30%] -translate-x-1/2 -translate-y-1/2">
          {miniIcon(NOCTURNE, 'border-red-400')}
        </span>
        {MINI_SPOTS.slice(0, 2).map((spot, lane) => (
          <motion.span
            key={lane}
            animate={{ scale: [1, 1.25, 1] }}
            transition={{ duration: 1, delay: lane * 0.5, repeat: Infinity }}
            style={spot}
            className="absolute -translate-x-1/2 -translate-y-1/2 font-display text-xl font-black text-gold sm:text-3xl"
          >
            ?
          </motion.span>
        ))}
      </MiniMap>
    )
  }
  return (
    <MiniMap>
      <span style={{ left: '18%', top: '18%' }} className="absolute w-[28%] -translate-x-1/2 -translate-y-1/2">
        {miniIcon(TWISTED_FATE, 'border-hextech')}
      </span>
      <span style={{ left: '40%', top: '30%' }} className="absolute w-[24%] -translate-x-1/2 -translate-y-1/2">
        {miniIcon(NOCTURNE, 'border-red-400')}
      </span>
      <span style={{ left: '62%', top: '22%' }} className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-red-500/85 px-1 text-[10px] font-black text-white sm:text-xs">
        +2
      </span>
    </MiniMap>
  )
}
