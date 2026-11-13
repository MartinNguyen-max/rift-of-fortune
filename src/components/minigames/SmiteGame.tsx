import { motion } from 'framer-motion'
import { useMemo, type ReactNode } from 'react'
import { mapIconUrl, spellIconUrl } from '../../data'
import {
  duelOfStep,
  hpAt,
  NO_SMITE,
  SMITE_PROFILES,
  smiteOfMove,
  smiteScores,
  smiteTargets,
  type SmiteDuel,
  type SmiteOutcome,
  type SmiteResult,
  type SmiteTarget,
} from '../../game/minigames/smite'
import { other, type Player } from '../../game/minigames/versus'
import { GetReady } from './GetReady'
import { championIconById } from './miniGameArt'
import { BigCall, ContestantTag, Waiting } from './parts'
import { formatHp, hpOfSmite, smiteNote, TARGET_NAMES } from './smiteScreen'
import { useShownWhen } from './timing'
import type { Contestant, MiniGameViewProps, RevealProps, TutorialArtProps } from './types'
import { sum, useStepFlow, useTimedPress } from './stepFlow'

const SMITE_ICON = spellIconUrl('SummonerSmite.png')
/** Time from your smite until the opponent's smite shows. */
const REVEAL_MS = 900
/** How long a finished duel stays up before the next one. */
const BETWEEN_DUELS_MS = 3400
/** How long the last duel's result shows before Victory or Defeat. */
const LAST_DUEL_MS = 3000

const PIT_COLORS: Record<SmiteTarget, string> = {
  baron: 'from-purple-800/45 via-purple-950/40',
  elder: 'from-cyan-800/35 via-slate-900/40',
}

const percent = (share: number) => `${share * 100}%`

/** Lee Sin vs Nunu & Willump: the health drains at a changing pace; smite it as low as you dare. */
export function SmiteGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const targets = smiteTargets(setup)
  const flow = useStepFlow({ moves, me, steps: targets.length, sendMove, revealMs: REVEAL_MS, pauseMs: BETWEEN_DUELS_MS })
  useShownWhen(flow.over, onShown, LAST_DUEL_MS)

  const { step } = flow
  const duel = useMemo(() => duelOfStep(setup, step), [setup, step])
  const scores = useMemo(() => smiteScores(moves, setup), [moves, setup])
  if (!duel) return null

  const myResult = flow.myMove === undefined ? null : smiteOfMove(duel, flow.myMove)
  const theirResult = flow.theirMove === undefined ? null : smiteOfMove(duel, flow.theirMove)
  const mine = [...scores[me].slice(0, step), ...(myResult ? [myResult.score] : [])]
  const theirs = [...scores[them].slice(0, step), ...(theirResult ? [theirResult.score] : [])]

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ContestantTag contestant={players[me]} you value={`${sum(mine)}`} />
        <TargetTrack targets={targets} current={step} mine={mine} theirs={theirs} />
        <ContestantTag contestant={players[them]} you={false} value={`${sum(theirs)}`} />
      </div>
      <SmiteRound
        key={step}
        duel={duel}
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

interface TargetTrackProps {
  targets: SmiteTarget[]
  current: number
  mine: number[]
  theirs: number[]
}

/** The objectives in play: a gold ring when you won that duel, red when they did. */
function TargetTrack({ targets, current, mine, theirs }: TargetTrackProps) {
  return (
    <div className="flex items-center gap-1.5">
      {targets.map((target, index) => {
        const a = mine[index]
        const b = theirs[index]
        const ring =
          a === undefined || b === undefined
            ? index === current
              ? 'border-hextech'
              : 'border-gold/30 opacity-50'
            : a > b
              ? 'border-gold'
              : a < b
                ? 'border-red-400'
                : 'border-gold-light/60'
        return (
          <img
            key={target}
            src={mapIconUrl(target)}
            alt={TARGET_NAMES[target]}
            className={`size-9 rounded-full border-2 bg-abyss object-contain p-0.5 ${ring}`}
          />
        )
      })}
    </div>
  )
}

interface SmiteRoundProps {
  duel: SmiteDuel
  /** Your smite for this duel once it is in. */
  myMove: number | undefined
  /** The opponent's smite, once it may be shown. */
  theirMove: number | undefined
  /** The opponent's name while their smite hasn't arrived. */
  waitingFor: string | null
  me: Player
  players: readonly [Contestant, Contestant]
  onPress: (ms: number) => void
}

/** One duel: 3-2-1, the health drains, you smite. Mounted fresh per duel so its clock starts at 0. */
function SmiteRound({ duel, myMove, theirMove, waitingFor, me, players, onPress }: SmiteRoundProps) {
  const timed = useTimedPress({ move: myMove, limitMs: duel.deathAt * 1000, missed: NO_SMITE, onPress })
  const smited = myMove !== undefined
  const hp = smited ? hpOfSmite(duel, myMove) : timed.running ? hpAt(duel, timed.seconds) : 1
  const myResult = smited ? smiteOfMove(duel, myMove) : null
  const theirResult = theirMove === undefined ? null : smiteOfMove(duel, theirMove)
  const inRange = hp > 0 && hp <= duel.threshold
  const theirHp = theirMove === undefined ? 0 : hpOfSmite(duel, theirMove)

  return (
    <div className="flex w-full touch-manipulation flex-col items-center gap-3 select-none" onPointerDown={timed.press}>
      <motion.div
        animate={smited ? { x: [0, -8, 8, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className={`relative w-full cursor-pointer overflow-hidden rounded-lg border-2 bg-linear-to-b to-abyss px-6 pt-2 pb-12 ${PIT_COLORS[duel.target]} ${
          inRange && !smited ? 'border-gold' : 'border-gold/40'
        }`}
      >
        <span className="absolute top-2 left-3 text-xs font-semibold tracking-widest text-gold-light/70 uppercase">
          {TARGET_NAMES[duel.target]}
        </span>
        <div className="relative flex h-32 items-center justify-center">
          <Objective target={duel.target} draining={timed.running} outcome={myResult?.outcome ?? null} />
          <div className="absolute inset-0 flex items-center justify-center">
            {myResult ? <SmiteCall result={myResult} /> : !timed.started && <GetReady onGo={timed.start} />}
          </div>
        </div>
        <HealthBar
          duel={duel}
          hp={hp}
          inRange={inRange}
          myMark={smited && hp > 0 ? hp : null}
          theirMark={theirHp > 0 ? theirHp : null}
          theirChampion={players[other(me)].champion}
        />
      </motion.div>
      <div className="flex h-28 w-full items-center justify-center">
        {!myResult ? (
          <SmiteButton active={timed.running} hot={inRange} onPress={timed.press} />
        ) : theirResult ? (
          <DuelVersus mine={myResult} theirs={theirResult} me={me} players={players} />
        ) : (
          waitingFor && <Waiting name={waitingFor} />
        )}
      </div>
    </div>
  )
}

interface ObjectiveProps {
  target: SmiteTarget
  draining: boolean
  /** How your smite went, once you smited (or it died). */
  outcome: SmiteOutcome | null
}

/** Baron or Elder, shaking while it takes damage and dimmed otherwise; struck by your smite, or grey once it died. */
function Objective({ target, draining, outcome }: ObjectiveProps) {
  return (
    <div className="relative">
      <motion.img
        src={mapIconUrl(target)}
        alt=""
        draggable={false}
        animate={draining ? { rotate: [0, -4, 4, 0], scale: [1, 0.96, 1] } : { rotate: 0, scale: 1 }}
        transition={draining ? { duration: 0.45, repeat: Infinity } : { duration: 0.2 }}
        className={`size-24 object-contain transition-opacity duration-500 sm:size-28 ${draining ? '' : 'opacity-40'} ${
          outcome === 'late' ? 'grayscale' : ''
        }`}
      />
      {outcome && outcome !== 'late' && <SmiteBolt />}
    </div>
  )
}

/** A bolt of smite striking the objective. */
function SmiteBolt() {
  return (
    <>
      <motion.span
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: [0, 1, 1, 0], scaleY: [0, 1, 1, 1] }}
        transition={{ duration: 0.5, times: [0, 0.2, 0.6, 1] }}
        className="absolute -top-12 left-1/2 h-[calc(100%+3rem)] w-3 origin-top -translate-x-1/2 rounded-full bg-linear-to-b from-white via-yellow-200 to-amber-400 shadow-[0_0_20px_rgb(253_224_71)]"
        aria-hidden="true"
      />
      <motion.span
        initial={{ scale: 0.3, opacity: 0.9 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="absolute inset-0 rounded-full bg-yellow-100/70 blur-md"
        aria-hidden="true"
      />
    </>
  )
}

/** Your smite, huge: the score in range, otherwise too early or too late, and 0. */
function SmiteCall({ result }: { result: SmiteResult }) {
  if (result.outcome === 'hit') return <BigCall text={`${result.score}`} tone="win" sub={`${formatHp(result.hp)} HP`} />
  return (
    <div className="flex flex-col items-center gap-1">
      <BigCall text={result.outcome === 'early' ? 'TOO EARLY!' : 'TOO LATE!'} tone="lose" size="large" />
      <motion.span
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 12 }}
        className="font-display text-5xl leading-none font-black text-red-500"
      >
        0
      </motion.span>
    </div>
  )
}

interface HealthBarProps {
  duel: SmiteDuel
  hp: number
  inRange: boolean
  /** Where your smite landed (0–1), once you smited in time. */
  myMark: number | null
  /** Where the opponent's smite landed, once shown. */
  theirMark: number | null
  theirChampion: string
}

/** The draining health with smite range as a gold zone at the left end. */
function HealthBar({ duel, hp, inRange, myMark, theirMark, theirChampion }: HealthBarProps) {
  const { maxHp } = SMITE_PROFILES[duel.target]
  return (
    <div className="relative mt-12 h-11 sm:h-12">
      <div className="absolute inset-0 overflow-hidden rounded-md border-2 border-gold/60 bg-abyss">
        <div className={`absolute inset-y-0 left-0 ${inRange ? 'bg-amber-400' : 'bg-purple-600'}`} style={{ width: percent(hp) }} />
        <div
          className={`absolute inset-y-0 left-0 border-r-2 border-dashed border-gold ${inRange ? 'animate-pulse bg-gold/45' : 'bg-gold/20'}`}
          style={{ width: percent(duel.threshold) }}
        />
        <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold text-white drop-shadow-[0_1px_2px_black]">
          {formatHp(hp * maxHp)} / {formatHp(maxHp)}
        </span>
      </div>
      {myMark !== null && <SmiteMark position={myMark} />}
      {theirMark !== null && <TheirMark position={theirMark} champion={theirChampion} />}
    </div>
  )
}

/** Your smite on the bar: a blue line with the Smite icon dropping onto it. */
function SmiteMark({ position }: { position: number }) {
  return (
    <div className="pointer-events-none absolute inset-y-0" style={{ left: percent(position) }}>
      <div className="absolute inset-y-0 left-0 w-1.5 -translate-x-1/2 rounded-full bg-hextech shadow-[0_0_12px_rgb(10_200_185)]" />
      <motion.img
        src={SMITE_ICON}
        alt=""
        initial={{ y: -30, scale: 1.5, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        className="absolute -top-11 left-0 size-9 max-w-none -translate-x-1/2 rounded-md border-2 border-hextech"
      />
    </div>
  )
}

/** The opponent's smite: a red line with their champion popping up from below. */
function TheirMark({ position, champion }: { position: number; champion: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pointer-events-none absolute inset-y-0" style={{ left: percent(position) }}>
      <div className="absolute inset-y-0 left-0 w-1.5 -translate-x-1/2 rounded-full bg-red-400 shadow-[0_0_12px_rgb(248_113_113)]" />
      <motion.img
        src={championIconById(champion)}
        alt=""
        initial={{ y: 24, scale: 1.4 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        className="absolute -bottom-10 left-0 size-9 max-w-none -translate-x-1/2 rounded-full border-2 border-red-400"
      />
    </motion.div>
  )
}

function SmiteButton({ active, hot, onPress }: { active: boolean; hot: boolean; onPress: () => void }) {
  return (
    <motion.button
      type="button"
      aria-label="Smite"
      disabled={!active}
      onClick={onPress}
      whileTap={{ scale: 0.88 }}
      animate={hot ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={hot ? { duration: 0.6, repeat: Infinity } : { duration: 0.2 }}
      className={`relative flex size-28 touch-manipulation items-center justify-center overflow-hidden rounded-full border-4 border-amber-300 bg-abyss disabled:opacity-40 ${
        hot ? 'shadow-[0_0_32px_rgb(251_191_36/0.8)]' : 'shadow-lg shadow-amber-500/30'
      }`}
    >
      <img src={SMITE_ICON} alt="" draggable={false} className="absolute inset-0 size-full object-cover opacity-75" />
      <span className="relative font-display text-2xl font-black text-white drop-shadow-[0_2px_4px_black]">SMITE</span>
    </motion.button>
  )
}

interface DuelVersusProps {
  mine: SmiteResult
  theirs: SmiteResult
  me: Player
  players: readonly [Contestant, Contestant]
}

/** Both smites side by side: score and where it landed, the higher score in gold. */
function DuelVersus({ mine, theirs, me, players }: DuelVersusProps) {
  return (
    <motion.div
      initial={{ y: 14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="grid w-full max-w-xs grid-cols-[1fr_auto_1fr] items-center gap-3"
      aria-live="polite"
    >
      <VersusSide contestant={players[me]} you result={mine} best={mine.score > theirs.score} />
      <span className="font-display text-lg text-gold/60">vs</span>
      <VersusSide contestant={players[other(me)]} you={false} result={theirs} best={theirs.score > mine.score} />
    </motion.div>
  )
}

function VersusSide({ contestant, you, result, best }: { contestant: Contestant; you: boolean; result: SmiteResult; best: boolean }) {
  const color = best ? 'text-gold' : you ? 'text-hextech' : 'text-red-400'
  return (
    <div className={`flex items-center gap-2 ${you ? 'justify-end' : 'flex-row-reverse justify-end'}`}>
      <img
        src={championIconById(contestant.champion)}
        alt={contestant.name}
        className={`size-10 shrink-0 rounded-full border-2 ${you ? 'border-hextech' : 'border-red-400'}`}
      />
      <div className={`flex flex-col leading-none ${you ? 'items-start' : 'items-end'}`}>
        <span className={`font-display text-4xl font-black tabular-nums ${color}`}>{result.score}</span>
        <span className={`text-[11px] font-semibold whitespace-nowrap ${result.outcome === 'hit' ? 'text-gold-light/70' : 'text-red-400'}`}>
          {smiteNote(result)}
        </span>
      </div>
    </div>
  )
}

/** Who got it: the objective flies to the winner's side (you left, them right), both scores under. */
export function SmiteReveal({ setup, me, settled, players }: RevealProps) {
  const them = other(me)
  const targets = smiteTargets(setup)
  const target = targets[targets.length - 1] ?? 'baron'
  const { winner } = settled
  const landing = winner === null ? '50%' : winner === me ? '16.667%' : '83.333%'
  const taker = winner === null ? 'Nobody' : players[winner].name

  return (
    <div className="relative h-44 w-80 max-w-full">
      <p className="sr-only" role="status">
        {TARGET_NAMES[target]}: {taker} gets it.
      </p>
      <motion.img
        src={mapIconUrl(target)}
        alt=""
        initial={{ left: '50%', y: 0, scale: 1.3 }}
        animate={
          winner === null
            ? { left: '50%', rotate: [0, -10, 10, -6, 6, 0], scale: 1.1 }
            : { left: landing, y: [0, -22, 0], scale: [1.3, 1.4, 1] }
        }
        transition={{ delay: 0.5, duration: 0.9, ease: 'easeInOut' }}
        className="absolute top-0 size-16 max-w-none -translate-x-1/2 object-contain drop-shadow-[0_0_14px_rgb(200_170_110/0.7)]"
      />
      <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 items-end">
        <RevealSide contestant={players[me]} you score={settled.scores[me]} won={winner === me} draw={winner === null} />
        <span className="pb-9 text-center font-display text-lg text-gold/60">vs</span>
        <RevealSide contestant={players[them]} you={false} score={settled.scores[them]} won={winner === them} draw={winner === null} />
      </div>
    </div>
  )
}

interface RevealSideProps {
  contestant: Contestant
  you: boolean
  score: number
  won: boolean
  draw: boolean
}

function RevealSide({ contestant, you, score, won, draw }: RevealSideProps) {
  const border = you ? 'border-hextech' : 'border-red-400'
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5">
      <div className="relative">
        {won && (
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.7], opacity: [0, 1, 0] }}
            transition={{ delay: 1.3, duration: 0.8 }}
            className={`absolute inset-0 rounded-full border-4 ${border}`}
            aria-hidden="true"
          />
        )}
        <img
          src={championIconById(contestant.champion)}
          alt=""
          className={`size-14 rounded-full border-2 ${border} ${won || draw ? '' : 'opacity-60 grayscale'}`}
        />
      </div>
      <span className={`max-w-full truncate text-xs font-semibold ${you ? 'text-hextech' : 'text-red-400'}`}>{contestant.name}</span>
      <span className={`font-display text-2xl leading-none font-black ${won ? 'text-gold' : draw ? 'text-gold-light' : 'text-gold-light/50'}`}>
        {score}
      </span>
    </div>
  )
}

/** A mini health bar with the gold smite zone at the left end. */
function MiniHealth({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[16%] w-[84%] overflow-hidden rounded border-2 border-gold/60 bg-abyss">
      {children}
      <div className="absolute inset-y-0 left-0 w-[14%] border-r border-dashed border-gold bg-gold/30" />
    </div>
  )
}

/** 1: Baron's health drains, fast and slow. 2: smite in the gold zone. 3: low health, big score. */
export function SmiteTutorialArt({ step }: TutorialArtProps) {
  if (step === 0) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-[8%] bg-linear-to-b from-purple-800/45 to-abyss">
        <img src={mapIconUrl('baron')} alt="" className="size-[46%] object-contain" />
        <MiniHealth>
          <motion.div
            animate={{ width: ['100%', '84%', '78%', '40%', '33%', '6%'] }}
            transition={{ duration: 3.2, times: [0, 0.15, 0.45, 0.6, 0.85, 1], repeat: Infinity, repeatDelay: 0.5, ease: 'linear' }}
            className="absolute inset-y-0 left-0 bg-purple-600"
          />
        </MiniHealth>
      </div>
    )
  }
  if (step === 1) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-[10%] bg-linear-to-b from-purple-800/45 to-abyss">
        <MiniHealth>
          <div className="absolute inset-y-0 left-0 w-[9%] bg-amber-400" />
        </MiniHealth>
        <div className="relative flex size-[42%] items-center justify-center">
          <motion.span
            animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
            transition={{ duration: 1.1, repeat: Infinity }}
            className="absolute inset-0 rounded-full border-2 border-amber-300"
          />
          <motion.img
            src={SMITE_ICON}
            alt=""
            animate={{ scale: [1, 0.86, 1] }}
            transition={{ duration: 1.1, repeat: Infinity }}
            className="relative size-full rounded-full border-2 border-amber-300"
          />
        </div>
      </div>
    )
  }
  return (
    <div className="flex size-full flex-col items-center justify-center gap-[8%] bg-linear-to-b from-purple-800/45 to-abyss">
      <motion.span
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="font-display text-2xl font-black text-gold drop-shadow-[0_0_10px_rgb(200_170_110/0.8)] sm:text-4xl"
      >
        98
      </motion.span>
      <MiniHealth>
        <div className="absolute inset-y-0 left-0 w-[2%] bg-amber-400" />
        <span className="absolute inset-y-0 left-[2%] z-10 w-1 -translate-x-1/2 bg-hextech shadow-[0_0_6px_rgb(10_200_185)]" />
      </MiniHealth>
    </div>
  )
}
