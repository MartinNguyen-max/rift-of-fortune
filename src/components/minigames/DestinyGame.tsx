import { motion } from 'framer-motion'
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { spellIconUrl, summonersRiftMapUrl } from '../../data'
import { MINI_GAMES } from '../../game/minigames/catalog'
import {
  DESTINY_SECONDS,
  destinyHalves,
  destinyPoints,
  destinyResults,
  gateMove,
  gaterOf,
  halfScore,
  NO_GUARD,
  readGate,
  TIMEOUT_GATE,
  type DestinyHalf,
} from '../../game/minigames/destiny'
import { LANE_NAMES, LANE_SPOTS, type Lane } from '../../game/minigames/riftLanes'
import { other, type BothMoves, type GameSetup, type Player } from '../../game/minigames/versus'
import { DESTINY_BEAT, destinyCall, destinyPhase, useDestinyReveal, type DestinyBeat, type DestinyPhase } from './destinyScreen'
import { LaneMap, LaneToken } from './LaneMap'
import { LANE_SIDES, placeAt, useLaneKeys } from './laneScreen'
import { championIconById } from './miniGameArt'
import { BigCall, ChoiceTimer, ContestantTag, Waiting } from './parts'
import { useShownWhen } from './timing'
import type { Contestant, MiniGameViewProps, TutorialArtProps } from './types'

/** Twisted Fate always Gates and Ahri always guards: the role, not the player, picks the art. */
const GATER_ART = MINI_GAMES.destiny.champion
const GUARD_ART = MINI_GAMES.destiny.botChampion
const CARD_ART = spellIconUrl('PickACard.png')
const DESTINY_ART = spellIconUrl('Destiny.png')
/** How long the last call stays up before Victory or Defeat covers it. */
const LAST_CALL_HOLD_MS = 2400

type Players = readonly [Contestant, Contestant]

/** Twisted Fate shows a card over a lane, then Gates in: there, or a bluff. The guard picks one lane to guard. */
export function DestinyGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const halves = destinyHalves(setup)
  const results = useMemo(() => destinyResults(moves, setup), [moves, setup])
  const { half, beat, revealing } = useDestinyReveal(results.length, setup)
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

/** One half: the choices while it is played, then its reveal. Mounted fresh per half. */
function HalfView({ half, setup, me, moves, revealing, beat, result, players, sendMove }: HalfViewProps) {
  const [card, setCard] = useState<Lane | null>(null)
  const phase = destinyPhase(half, me, moves, setup, revealing, card !== null)
  const gater = gaterOf(half, setup)
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
  const pick = useCallback(
    (lane: Lane) => {
      if (phase === 'card') setCard(lane)
      else if (phase === 'gate' && card !== null) send(gateMove({ card, lane }))
      else if (phase === 'guard') send(lane)
    },
    [phase, card, send],
  )
  const picking = phase === 'card' || phase === 'gate' || phase === 'guard'
  useLaneKeys(pick, picking)

  const gatedMove = moves[gater][half]
  const gate = gatedMove === undefined ? null : readGate(gatedMove)
  // The card shows to Twisted Fate once picked, and to the guard once he has shown it.
  const shownCard = gater === me ? (gate?.card ?? card) : phase === 'guard' || revealing ? (gate?.card ?? null) : null
  const call = result && beat >= DESTINY_BEAT.called ? destinyCall(result, me, [players[0].name, players[1].name]) : null
  const variant = setup.variant

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex min-h-14 w-full items-center justify-center">
        {(phase === 'card' || phase === 'gate') && (
          <ChoiceTimer
            key={`gate-${half}`}
            seconds={DESTINY_SECONDS.gate[variant]}
            label="Gate"
            onTimeout={() => send(card === null ? TIMEOUT_GATE : gateMove({ card, lane: card }))}
          />
        )}
        {phase === 'guard' && <ChoiceTimer key={`guard-${half}`} seconds={DESTINY_SECONDS.guard[variant]} label="Guard" onTimeout={() => send(NO_GUARD)} />}
        {(phase === 'gated' || phase === 'waitCard') && <Waiting name={players[them].name} />}
      </div>
      <div className="flex min-h-16 w-full items-center justify-center text-center">
        {call ? (
          <BigCall text={call.text} tone={call.tone} sub={call.sub} size="large" />
        ) : (
          <Prompt phase={phase} card={card} shownCard={shownCard} gate={gate} them={players[them].name} />
        )}
      </div>
      <LaneMap
        onPick={picking ? pick : null}
        pickVerb={phase === 'card' ? 'Show the card over' : phase === 'gate' ? 'Gate to' : 'Guard'}
        frame={call?.tone ?? null}
      >
        {shownCard !== null && <CardOnLane lane={shownCard} />}
        {gater === me && gate && !revealing && <LaneToken champion={GATER_ART} at={LANE_SPOTS[gate.lane]} you label="Gate" />}
        {result && beat >= DESTINY_BEAT.guard && result.guard !== null && (
          <LaneToken champion={GUARD_ART} at={guardSpot(result)} you={other(result.gater) === me} label="Guard" />
        )}
        {result && beat >= DESTINY_BEAT.landed && (
          <LaneToken champion={GATER_ART} at={LANE_SPOTS[result.lane]} you={result.gater === me} size="large" drop label="Gate" />
        )}
        {result && beat >= DESTINY_BEAT.landed && <Clash result={result} />}
      </LaneMap>
    </div>
  )
}

/** The guard stands in their lane, or beside it when Twisted Fate lands in the same one. */
function guardSpot({ guard, lane }: DestinyHalf) {
  return guard === lane ? LANE_SIDES[lane][1] : LANE_SPOTS[guard ?? lane]
}

interface PromptProps {
  phase: DestinyPhase
  card: Lane | null
  shownCard: Lane | null
  gate: { card: Lane; lane: Lane } | null
  them: string
}

/** One short line saying what to do now. */
function Prompt({ phase, card, shownCard, gate, them }: PromptProps) {
  const line = (main: string, sub?: string) => (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-display text-lg leading-tight font-black text-gold-light">{main}</span>
      {sub && <span className="text-xs text-gold-light/70">{sub}</span>}
    </div>
  )
  if (phase === 'card') {
    return (
      <div className="flex items-center gap-2">
        <img src={DESTINY_ART} alt="" className="size-9 rounded-md border border-gold/60" />
        {line('You are Twisted Fate', 'Tap a lane to show your card there')}
      </div>
    )
  }
  if (phase === 'gate' && card !== null) return line('Now Gate in', `${LANE_NAMES[card]} (the card): +2 if free · another lane: +1`)
  if (phase === 'gated' && gate) return line(`Gating ${LANE_NAMES[gate.lane]}…`, gate.card === gate.lane ? 'Under your card. Will they believe it?' : 'A bluff. Will they fall for it?')
  if (phase === 'waitCard') return line(`${them} is Twisted Fate`, 'Watch for the card…')
  if (phase === 'guard' && shownCard !== null) return line(`The card is over ${LANE_NAMES[shownCard]}`, 'Guard the lane he Gates to: +1')
  return null
}

/** The gold card hanging over a lane. */
function CardOnLane({ lane }: { lane: Lane }) {
  return (
    <motion.div
      initial={{ y: -30, rotate: -20, opacity: 0 }}
      animate={{ y: 0, rotate: [0, -6, 6, 0], opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={placeAt(LANE_SIDES[lane][0])}
      className="pointer-events-none absolute z-20 w-[11%] -translate-x-1/2 -translate-y-1/2"
    >
      <motion.img
        src={CARD_ART}
        alt="Card"
        animate={{ boxShadow: ['0 0 6px rgb(240 200 90 / 0.5)', '0 0 22px rgb(240 200 90 / 0.95)', '0 0 6px rgb(240 200 90 / 0.5)'] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="aspect-[3/4] w-full rounded-md border-2 border-gold object-cover"
      />
    </motion.div>
  )
}

/** A burst where the Gate lands: gold when it was free, red sparks when it was guarded. */
function Clash({ result }: { result: DestinyHalf }) {
  const spot = LANE_SPOTS[result.lane]
  return (
    <motion.span
      initial={{ scale: 0.2, opacity: 1 }}
      animate={{ scale: 2.4, opacity: 0 }}
      transition={{ duration: 0.7 }}
      style={placeAt(spot)}
      className={`pointer-events-none absolute z-0 size-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border-4 ${
        result.guarded ? 'border-red-500' : 'border-gold'
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
          ? halfScore(result).scorer === me
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

/** 1: a card over a lane. 2: Twisted Fate Gates there, or somewhere else. 3: guarded +1, free +2. */
export function DestinyTutorialArt({ step }: TutorialArtProps) {
  if (step === 0) {
    return (
      <MiniMap>
        <motion.img
          src={CARD_ART}
          alt=""
          animate={{ y: [0, -3, 0], rotate: [-8, 8, -8] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          style={{ left: '18%', top: '10%' }}
          className="absolute w-[24%] -translate-x-1/2 -translate-y-1/2 rounded border-2 border-gold"
        />
        <span style={{ left: '62%', top: '72%' }} className="absolute w-[30%] -translate-x-1/2 -translate-y-1/2">
          {miniIcon(GATER_ART, 'border-hextech')}
        </span>
      </MiniMap>
    )
  }
  if (step === 1) {
    return (
      <MiniMap>
        <img src={CARD_ART} alt="" style={{ left: '18%', top: '10%' }} className="absolute w-[20%] -translate-x-1/2 -translate-y-1/2 rounded border border-gold" />
        <motion.span
          animate={{ left: ['18%', '18%', '50%', '50%', '18%'], top: ['18%', '18%', '50%', '50%', '18%'] }}
          transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.35, 0.5, 0.85, 1] }}
          className="absolute w-[30%] -translate-x-1/2 -translate-y-1/2"
        >
          {miniIcon(GATER_ART, 'border-hextech')}
        </motion.span>
        <span style={{ left: '78%', top: '30%' }} className="absolute -translate-x-1/2 -translate-y-1/2 font-display text-xl font-black text-gold sm:text-3xl">
          ?
        </span>
      </MiniMap>
    )
  }
  return (
    <MiniMap>
      <span style={{ left: '50%', top: '50%' }} className="absolute w-[30%] -translate-x-1/2 -translate-y-1/2">
        {miniIcon(GUARD_ART, 'border-red-400')}
      </span>
      <span style={{ left: '50%', top: '22%' }} className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-red-500/85 px-1 text-[10px] font-black text-white sm:text-xs">
        +1
      </span>
      <span style={{ left: '82%', top: '82%' }} className="absolute w-[28%] -translate-x-1/2 -translate-y-1/2">
        {miniIcon(GATER_ART, 'border-hextech')}
      </span>
      <span style={{ left: '74%', top: '58%' }} className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-gold/90 px-1 text-[10px] font-black text-abyss sm:text-xs">
        +2
      </span>
    </MiniMap>
  )
}
