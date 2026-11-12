import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { championLoadingUrl, spellIconUrl } from '../../data'
import {
  botDodge,
  botThrow,
  CLEAVER_HITS_TO_WIN,
  cleaverWinner,
  DEFAULT_LANE,
  hitsTaken,
  isHit,
  LANES,
  PICK_SECONDS,
  stepLane,
  throwerOfRound,
  type CleaverRound,
  type Lane,
} from '../../game/minigames/cleaver'
import { seededRandom } from '../../game/random'
import { useCountdown } from '../multiplayer/useCountdown'
import type { MiniGameProps } from './MiniGameShell'
import { SKINS } from './miniGameArt'

/** Shown health: each cleaver takes a third. Mundo's Q really does hit hard. */
const MUNDO_MAX_HP = 3000
const FLIGHT_SECONDS = 0.9
const AFTER_SECONDS = 1.5

const HIT_LINES = ['Mundo smash!', 'Cleaver to the face!', 'Infected Bonesaw connects!']
const MISS_LINES = ['Mundo goes where he pleases!', 'Whiff! Mundo dodged.', 'Missed. Mundo is not impressed.']

type Phase = 'pick' | 'flight' | 'after'

/** Mundo Goes Where He Pleases: take turns throwing and dodging cleavers across three lanes. */
export function CleaverGame({ seed, onFinish }: MiniGameProps) {
  const [random] = useState(() => seededRandom(seed))
  const [rounds, setRounds] = useState<CleaverRound[]>([])
  const [phase, setPhase] = useState<Phase>('pick')
  const [lane, setLane] = useState<Lane>(DEFAULT_LANE)
  const thrower = throwerOfRound(rounds.length - (phase === 'pick' ? 0 : 1))
  const playerThrows = thrower === 'player'
  const current = phase === 'pick' ? null : rounds.at(-1)
  const taken = hitsTaken(phase === 'flight' ? rounds.slice(0, -1) : rounds)

  const lockIn = useCallback(
    (choice: Lane) => {
      if (phase !== 'pick') return
      const myThrows = rounds.filter((round) => round.thrower === 'player').map((round) => round.throwLane)
      const myDodges = rounds.filter((round) => round.thrower === 'bot').map((round) => round.dodgeLane)
      const round: CleaverRound = playerThrows
        ? { thrower: 'player', throwLane: choice, dodgeLane: botDodge(myThrows, random) }
        : { thrower: 'bot', throwLane: botThrow(myDodges, random), dodgeLane: choice }
      setLane(choice)
      setRounds([...rounds, round])
      setPhase('flight')
    },
    [phase, rounds, playerThrows, random],
  )

  // The cleaver flies, then lands; then the next round or the end.
  useEffect(() => {
    if (phase === 'pick') return
    const id = window.setTimeout(
      () => {
        if (phase === 'flight') {
          setPhase('after')
          return
        }
        const winner = cleaverWinner(rounds)
        if (winner) {
          const hits = hitsTaken(rounds)
          onFinish({ winner, player: `${hits.bot} hits landed`, bot: `${hits.player} hits landed` })
          return
        }
        setLane(DEFAULT_LANE)
        setPhase('pick')
      },
      (phase === 'flight' ? FLIGHT_SECONDS : AFTER_SECONDS) * 1000,
    )
    return () => window.clearTimeout(id)
  }, [phase, rounds, onFinish])

  useEffect(() => {
    if (phase !== 'pick') return
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'arrowup' || key === 'w') setLane((value) => stepLane(value, -1))
      else if (key === 'arrowdown' || key === 's') setLane((value) => stepLane(value, 1))
      else if (key === 'enter' || key === ' ') lockIn(lane)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, lane, lockIn])

  const timeout = useCallback(() => lockIn(lane), [lockIn, lane])
  const playerLane = current ? (current.thrower === 'player' ? current.throwLane : current.dodgeLane) : lane
  const botLane = current ? (current.thrower === 'bot' ? current.throwLane : current.dodgeLane) : DEFAULT_LANE
  const hit = phase === 'after' && current ? isHit(current) : false

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-4">
        <HealthBar label="Mundo (you)" hits={taken.player} ally />
        <HealthBar label="El Macho Mundo" hits={taken.bot} />
      </div>

      <div className="text-center">
        <p className="font-display text-xl font-black text-gold">
          {phase === 'pick' ? (playerThrows ? 'Throw your cleaver! Pick a lane.' : 'Dodge! Pick a lane.') : phase === 'flight' ? 'Cleaver incoming...' : hit ? pickLine(HIT_LINES, rounds.length) : pickLine(MISS_LINES, rounds.length)}
        </p>
        {phase === 'pick' && <PickTimer key={rounds.length} onTimeout={timeout} />}
      </div>

      <div className="relative grid grid-rows-3 gap-1.5 overflow-hidden rounded-lg border-2 border-gold/40 bg-linear-to-r from-emerald-950/70 via-slate-900/60 to-red-950/70 p-1.5">
        {LANES.map((row) => (
          <LaneRow
            key={row}
            lane={row}
            playerHere={playerLane === row}
            botHere={phase !== 'pick' && botLane === row}
            botHidden={phase === 'pick'}
            selectable={phase === 'pick'}
            selected={phase === 'pick' && lane === row}
            playerThrows={playerThrows}
            onPick={() => lockIn(row)}
            cleaver={current && current.throwLane === row ? { from: current.thrower, phase, hit } : null}
          />
        ))}
      </div>
      <p className="text-center text-xs text-gold-light/50">Tap a lane, or use ↑ ↓ and Enter. Mundo stays mid if you don’t pick.</p>
    </div>
  )
}

const pickLine = (lines: string[], index: number) => lines[index % lines.length] ?? lines[0] ?? ''

interface LaneRowProps {
  lane: Lane
  playerHere: boolean
  botHere: boolean
  botHidden: boolean
  selectable: boolean
  selected: boolean
  playerThrows: boolean
  onPick: () => void
  cleaver: { from: 'player' | 'bot'; phase: Phase; hit: boolean } | null
}

function LaneRow({ lane, playerHere, botHere, botHidden, selectable, selected, playerThrows, onPick, cleaver }: LaneRowProps) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!selectable}
      className={`relative flex h-20 items-center justify-between rounded-md border-2 px-2 transition sm:h-24 ${
        selected ? 'border-gold bg-gold/10' : 'border-transparent bg-abyss/30'
      } enabled:hover:border-gold/70`}
    >
      <span className="absolute inset-x-0 top-1 text-center text-[10px] tracking-[0.3em] text-gold-light/40 uppercase">{lane}</span>
      <Mundo visible={playerHere} src={championLoadingUrl('DrMundo', 0)} />
      {selectable && selected && playerThrows && (
        <span className="pointer-events-none absolute inset-x-20 top-1/2 h-0.5 -translate-y-1/2 border-t-2 border-dashed border-gold/60" />
      )}
      <AnimatePresence>
        {cleaver && (
          <motion.img
            src={spellIconUrl('DrMundoQ.png')}
            alt="Cleaver"
            className="absolute top-1/2 size-10 -translate-y-1/2 rounded-full border-2 border-red-300"
            initial={{ left: cleaver.from === 'player' ? '12%' : '80%', rotate: 0 }}
            animate={{
              left: cleaver.from === 'player' ? '80%' : '12%',
              rotate: cleaver.from === 'player' ? 720 : -720,
              opacity: cleaver.phase === 'after' && !cleaver.hit ? 0 : 1,
              scale: cleaver.phase === 'after' && cleaver.hit ? 1.5 : 1,
            }}
            transition={{ duration: FLIGHT_SECONDS, ease: 'linear' }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>
      <Mundo visible={botHere} hidden={botHidden} src={championLoadingUrl('DrMundo', SKINS.elMachoMundo)} mirrored />
    </button>
  )
}

function Mundo({ visible, hidden = false, src, mirrored = false }: { visible: boolean; hidden?: boolean; src: string; mirrored?: boolean }) {
  if (hidden) {
    return <span className="flex size-14 items-center justify-center font-display text-2xl text-gold-light/30 sm:size-16">?</span>
  }
  return (
    <span className="size-14 sm:size-16">
      {visible && (
        <motion.img
          layout
          src={src}
          alt=""
          className={`size-full rounded-full border-2 object-cover object-top ${mirrored ? '-scale-x-100 border-red-400' : 'border-emerald-400'}`}
        />
      )}
    </span>
  )
}

function HealthBar({ label, hits, ally = false }: { label: string; hits: number; ally?: boolean }) {
  const hpLeft = Math.max(0, CLEAVER_HITS_TO_WIN - hits)
  const hp = Math.round((hpLeft / CLEAVER_HITS_TO_WIN) * MUNDO_MAX_HP)
  return (
    <div className={`flex flex-col gap-1 ${ally ? '' : 'items-end'}`}>
      <span className="text-xs font-semibold text-gold-light/80">{label}</span>
      <div className="relative h-5 w-full overflow-hidden rounded-sm border border-black bg-black/80">
        <motion.div
          className={`absolute inset-y-0 left-0 ${ally ? 'bg-linear-to-b from-emerald-400 to-emerald-700' : 'bg-linear-to-b from-red-400 to-red-700'}`}
          animate={{ width: `${(hpLeft / CLEAVER_HITS_TO_WIN) * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        />
        {Array.from({ length: CLEAVER_HITS_TO_WIN - 1 }, (_, index) => (
          <span key={index} className="absolute inset-y-0 w-0.5 bg-black/80" style={{ left: `${((index + 1) / CLEAVER_HITS_TO_WIN) * 100}%` }} />
        ))}
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-bold text-white drop-shadow">
          {hp} / {MUNDO_MAX_HP}
        </span>
      </div>
    </div>
  )
}

function PickTimer({ onTimeout }: { onTimeout: () => void }) {
  const [deadline] = useState(() => Date.now() + PICK_SECONDS * 1000)
  const left = useCountdown(deadline)

  useEffect(() => {
    const id = window.setTimeout(onTimeout, Math.max(0, deadline - Date.now()))
    return () => window.clearTimeout(id)
  }, [deadline, onTimeout])

  return <p className={`font-mono text-sm ${left < 1 ? 'text-red-400' : 'text-gold-light/70'}`}>{left.toFixed(1)}s</p>
}
