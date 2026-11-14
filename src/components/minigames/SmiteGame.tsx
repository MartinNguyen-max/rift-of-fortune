import { motion } from 'framer-motion'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { mapIconUrl, spellIconUrl } from '../../data'
import {
  fightOfStep,
  fightWinner,
  formatSmiteScore,
  hpAt,
  NO_SMITE,
  SMITE_DAMAGE,
  smiteFights,
  smiteOfMove,
  smiteTargets,
  type SmiteFight,
  type SmiteOutcome,
  type SmiteResult,
  type SmiteTarget,
} from '../../game/minigames/smite'
import { MINI_GAMES } from '../../game/minigames/catalog'
import { other, type Player } from '../../game/minigames/versus'
import { GetReady } from './GetReady'
import { championIconById } from './miniGameArt'
import { BigCall, ContestantTag, Waiting } from './parts'
import { formatHp, hitsBy, hpOfSmite, missedReason, smiteNote, TARGET_NAMES } from './smiteScreen'
import { useShownWhen } from './timing'
import type { Contestant, MiniGameViewProps, RevealProps, TutorialArtProps } from './types'
import { useStepFlow, useTimedPress } from './stepFlow'

const SMITE_ICON = spellIconUrl('SummonerSmite.png')
/** Time from your smite until the opponent's smite shows. */
const REVEAL_MS = 900
/** How long a finished fight stays up before the next one. */
const BETWEEN_FIGHTS_MS = 3400
/** How long the last fight's result shows before Victory or Defeat. */
const LAST_FIGHT_MS = 3000

const PIT_COLORS: Record<SmiteTarget, string> = {
  baron: 'from-purple-800/45 via-purple-950/40',
  elder: 'from-cyan-800/35 via-slate-900/40',
}

const percent = (share: number) => `${share * 100}%`

/**
 * Lee Sin vs Lillia: both teams hit the objective, so its health drops in small hits.
 * Smite deals 1,600: the first smite at 1,600 health or less steals it. Too early does nothing.
 */
export function SmiteGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const targets = smiteTargets(setup)
  const flow = useStepFlow({ moves, me, steps: targets.length, sendMove, revealMs: REVEAL_MS, pauseMs: BETWEEN_FIGHTS_MS })
  useShownWhen(flow.over, onShown, LAST_FIGHT_MS)

  const { step } = flow
  const fight = useMemo(() => fightOfStep(setup, step), [setup, step])
  const fights = useMemo(() => smiteFights(moves, setup), [moves, setup])
  if (!fight) return null

  const myResult = flow.myMove === undefined ? null : smiteOfMove(fight, flow.myMove)
  const theirResult = flow.theirMove === undefined ? null : smiteOfMove(fight, flow.theirMove)
  const thisFight = myResult && theirResult ? winnerOf(myResult, theirResult, me) : undefined
  /** Who got each objective so far (null: nobody), as far as it may be shown. */
  const decided = [...fights.slice(0, step).map(({ winner }) => winner), ...(thisFight === undefined ? [] : [thisFight])]
  const steals = (player: Player) => decided.filter((winner) => winner === player).length

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ContestantTag contestant={players[me]} you value={`${steals(me)}`} />
        <TargetTrack targets={targets} current={step} decided={decided} me={me} />
        <ContestantTag contestant={players[them]} you={false} value={`${steals(them)}`} />
      </div>
      <SmiteRound
        key={step}
        fight={fight}
        myMove={flow.myMove}
        theirMove={flow.theirMove}
        waitingFor={flow.waiting ? players[them].name : null}
        me={me}
        players={players}
        onPress={flow.send}
      />
      <p className="text-xs text-gold-light/60">Tap, click or Space to smite</p>
    </div>
  )
}

/** The winner of a fight by player, from your result and theirs. */
const winnerOf = (mine: SmiteResult, theirs: SmiteResult, me: Player): Player | null => {
  const first = fightWinner(mine, theirs)
  return first === null ? null : first === 0 ? me : other(me)
}

interface TargetTrackProps {
  targets: SmiteTarget[]
  current: number
  decided: (Player | null)[]
  me: Player
}

/** The objectives in play: a gold ring when you stole it, red when they did. */
function TargetTrack({ targets, current, decided, me }: TargetTrackProps) {
  return (
    <div className="flex items-center gap-1.5">
      {targets.map((target, index) => {
        const winner = decided[index]
        const ring =
          winner === undefined
            ? index === current
              ? 'border-hextech'
              : 'border-gold/30 opacity-50'
            : winner === null
              ? 'border-gold-light/40 grayscale'
              : winner === me
                ? 'border-gold'
                : 'border-red-400'
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
  fight: SmiteFight
  /** Your smite for this fight once it is in. */
  myMove: number | undefined
  /** The opponent's smite, once it may be shown. */
  theirMove: number | undefined
  /** The opponent's name while their smite hasn't arrived. */
  waitingFor: string | null
  me: Player
  players: readonly [Contestant, Contestant]
  onPress: (ms: number) => void
}

/** One fight: 3-2-1, the health drops hit by hit, you smite. Mounted fresh per fight so its clock starts at 0. */
function SmiteRound({ fight, myMove, theirMove, waitingFor, me, players, onPress }: SmiteRoundProps) {
  const timed = useTimedPress({ move: myMove, limitMs: fight.deathAt * 1000, missed: NO_SMITE, onPress })
  const smited = myMove !== undefined
  const seconds = smited ? myMove / 1000 : timed.running ? timed.seconds : 0
  const hp = smited ? hpOfSmite(fight, myMove) : timed.running ? hpAt(fight, timed.seconds) : fight.startHp
  const hits = hitsBy(fight, seconds)
  const myResult = smited ? smiteOfMove(fight, myMove) : null
  const theirResult = theirMove === undefined ? null : smiteOfMove(fight, theirMove)
  const underLine = hp > 0 && hp <= SMITE_DAMAGE
  const theirHp = theirMove === undefined ? 0 : hpOfSmite(fight, theirMove)

  return (
    <div className="flex w-full touch-manipulation flex-col items-center gap-3 select-none" onPointerDown={timed.press}>
      <motion.div
        animate={smited ? { x: [0, -8, 8, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className={`relative w-full cursor-pointer overflow-hidden rounded-lg border-2 bg-linear-to-b to-abyss px-4 pt-2 pb-12 sm:px-6 ${PIT_COLORS[fight.target]} ${
          underLine && !smited ? 'border-gold' : 'border-gold/40'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold tracking-widest text-gold-light/70 uppercase">{TARGET_NAMES[fight.target]}</span>
          <span className="flex items-center gap-1 rounded-full border border-gold/50 bg-abyss/70 py-0.5 pr-2 pl-0.5 text-xs font-bold text-gold">
            <img src={SMITE_ICON} alt="" className="size-5 rounded-full" />
            Smite: {formatHp(SMITE_DAMAGE)}
          </span>
        </div>
        <div className="relative flex h-28 items-center justify-center">
          <Objective target={fight.target} fighting={timed.running} hits={hits.count} outcome={myResult?.outcome ?? null} />
          <div className="absolute inset-0 flex items-center justify-center">
            {myResult ? <SmiteCall result={myResult} /> : !timed.started && <GetReady onGo={timed.start} />}
          </div>
        </div>
        <HealthDisplay
          fight={fight}
          hp={hp}
          lastHit={timed.running ? { key: hits.count, damage: hits.lastDamage } : null}
          underLine={underLine}
          myMark={smited && hp > 0 ? hp : null}
          theirMark={theirHp > 0 ? theirHp : null}
          theirChampion={players[other(me)].champion}
        />
      </motion.div>
      <div className="flex h-28 w-full items-center justify-center">
        {!myResult ? (
          <SmiteButton active={timed.running} hot={underLine} onPress={timed.press} />
        ) : theirResult ? (
          <FightVersus mine={myResult} theirs={theirResult} me={me} players={players} />
        ) : (
          waitingFor && <Waiting name={waitingFor} />
        )}
      </div>
    </div>
  )
}

interface ObjectiveProps {
  target: SmiteTarget
  fighting: boolean
  /** Hits so far: it flinches at each one. */
  hits: number
  /** How your smite went, once you smited (or it died). */
  outcome: SmiteOutcome | null
}

/** Baron or Elder, flinching at every hit; struck by your smite, or grey once the teams killed it. */
function Objective({ target, fighting, hits, outcome }: ObjectiveProps) {
  return (
    <div className="relative">
      <motion.img
        src={mapIconUrl(target)}
        alt=""
        draggable={false}
        animate={fighting ? { rotate: hits % 2 ? -4 : 4, scale: hits % 2 ? 0.96 : 1 } : { rotate: 0, scale: 1 }}
        transition={{ duration: 0.08 }}
        className={`size-20 object-contain transition-opacity duration-500 sm:size-24 ${fighting || outcome ? '' : 'opacity-40'} ${
          outcome === 'late' ? 'grayscale' : ''
        }`}
      />
      {outcome === 'hit' && <SmiteBolt />}
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

/** Your smite, huge: SMITE! with how fast you were after the line, or why it did nothing. */
function SmiteCall({ result }: { result: SmiteResult }) {
  if (result.outcome === 'hit') return <BigCall text="SMITE!" tone="win" sub={`${result.reaction ?? 0} ms after it hit ${formatHp(SMITE_DAMAGE)}`} />
  return <BigCall text={result.outcome === 'early' ? 'TOO EARLY!' : 'TOO LATE!'} tone="lose" size="large" sub={missedReason(result)} />
}

interface HealthDisplayProps {
  fight: SmiteFight
  hp: number
  /** The latest hit, popping off the number. */
  lastHit: { key: number; damage: number } | null
  underLine: boolean
  /** Where your smite landed (in health), once you smited in time. */
  myMark: number | null
  /** Where the opponent's smite landed, once shown. */
  theirMark: number | null
  theirChampion: string
}

/**
 * The health as a big number and a bar, with Smite's 1,600 as a gold zone at the left end. The
 * bar shows the fight from the health it started at, so it drains from full and the zone is big.
 */
function HealthDisplay({ fight, hp, lastHit, underLine, myMark, theirMark, theirChampion }: HealthDisplayProps) {
  const share = (value: number) => value / fight.startHp
  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex items-baseline justify-center gap-1.5" aria-live="off">
        <span
          className={`font-mono text-4xl font-black tabular-nums drop-shadow-[0_2px_4px_black] sm:text-5xl ${underLine ? 'text-amber-300' : 'text-white'}`}
        >
          {formatHp(hp)}
        </span>
        <span className="text-sm text-gold-light/60">HP</span>
        {lastHit && lastHit.damage > 0 && (
          <motion.span
            key={lastHit.key}
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: -18, opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="absolute top-0 right-[12%] font-mono text-sm font-bold text-red-400"
            aria-hidden="true"
          >
            −{lastHit.damage}
          </motion.span>
        )}
      </div>
      <div className="relative mt-10 h-9 sm:h-10">
        <div className="absolute inset-0 overflow-hidden rounded-md border-2 border-gold/60 bg-abyss">
          <div className={`absolute inset-y-0 left-0 ${underLine ? 'bg-amber-400' : 'bg-purple-600'}`} style={{ width: percent(share(hp)) }} />
          <div
            className={`absolute inset-y-0 left-0 flex items-center justify-center border-r-2 border-gold ${underLine ? 'animate-pulse bg-gold/45' : 'bg-gold/20'}`}
            style={{ width: percent(share(SMITE_DAMAGE)) }}
          >
            <span className="font-mono text-[10px] font-bold text-gold drop-shadow-[0_1px_2px_black] sm:text-xs">{formatHp(SMITE_DAMAGE)}</span>
          </div>
        </div>
        {myMark !== null && <SmiteMark position={share(myMark)} />}
        {theirMark !== null && <TheirMark position={share(theirMark)} champion={theirChampion} />}
      </div>
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
        className="absolute -top-10 left-0 size-8 max-w-none -translate-x-1/2 rounded-md border-2 border-hextech"
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
      transition={hot ? { duration: 0.4, repeat: Infinity } : { duration: 0.2 }}
      className={`relative flex size-28 touch-manipulation items-center justify-center overflow-hidden rounded-full border-4 border-amber-300 bg-abyss disabled:opacity-40 ${
        hot ? 'shadow-[0_0_32px_rgb(251_191_36/0.8)]' : 'shadow-lg shadow-amber-500/30'
      }`}
    >
      <img src={SMITE_ICON} alt="" draggable={false} className="absolute inset-0 size-full object-cover opacity-75" />
      <span className="relative font-display text-2xl font-black text-white drop-shadow-[0_2px_4px_black]">SMITE</span>
    </motion.button>
  )
}

interface FightVersusProps {
  mine: SmiteResult
  theirs: SmiteResult
  me: Player
  players: readonly [Contestant, Contestant]
}

/** Both smites side by side: how fast after the line, or why it did nothing. The first one gets it. */
function FightVersus({ mine, theirs, me, players }: FightVersusProps) {
  const first = fightWinner(mine, theirs)
  return (
    <motion.div
      initial={{ y: 14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="grid w-full max-w-sm grid-cols-[1fr_auto_1fr] items-center gap-3"
      aria-live="polite"
    >
      <VersusSide contestant={players[me]} you result={mine} first={first === 0} />
      <span className="font-display text-lg text-gold/60">vs</span>
      <VersusSide contestant={players[other(me)]} you={false} result={theirs} first={first === 1} />
    </motion.div>
  )
}

function VersusSide({ contestant, you, result, first }: { contestant: Contestant; you: boolean; result: SmiteResult; first: boolean }) {
  const color = first ? 'text-gold' : you ? 'text-hextech' : 'text-red-400'
  const big = result.outcome === 'hit' ? `${result.reaction ?? 0}` : result.outcome === 'early' ? 'EARLY' : 'LATE'
  return (
    <div className={`flex min-w-0 items-center gap-2 ${you ? 'justify-end' : 'flex-row-reverse justify-end'}`}>
      <img
        src={championIconById(contestant.champion)}
        alt={contestant.name}
        className={`size-10 shrink-0 rounded-full border-2 ${you ? 'border-hextech' : 'border-red-400'} ${first ? 'shadow-[0_0_14px_rgb(200_170_110/0.8)]' : ''}`}
      />
      <div className={`flex min-w-0 flex-col leading-none ${you ? 'items-start' : 'items-end'}`}>
        <span className={`font-display text-3xl font-black tabular-nums ${color}`}>
          {big}
          {result.outcome === 'hit' && <span className="text-sm"> ms</span>}
        </span>
        <span className={`text-[11px] font-semibold whitespace-nowrap ${first ? 'text-gold' : 'text-gold-light/60'}`}>
          {first ? 'GOT IT!' : result.outcome === 'hit' ? 'Too slow' : smiteNote(result).split(' · ')[0]}
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
  const taker = winner === null ? 'Nobody gets' : winner === me ? 'You get' : `${players[winner].name} gets`

  return (
    <div className="relative h-44 w-80 max-w-full">
      <p className="sr-only" role="status">
        {TARGET_NAMES[target]}: {taker} it.
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
        <RevealSide contestant={players[me]} you text={formatSmiteScore(settled.scores[me], setup)} won={winner === me} draw={winner === null} />
        <span className="pb-6 text-center font-display text-lg text-gold/60">vs</span>
        <RevealSide contestant={players[them]} you={false} text={formatSmiteScore(settled.scores[them], setup)} won={winner === them} draw={winner === null} />
      </div>
    </div>
  )
}

interface RevealSideProps {
  contestant: Contestant
  you: boolean
  text: string
  won: boolean
  draw: boolean
}

function RevealSide({ contestant, you, text, won, draw }: RevealSideProps) {
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
      <span className={`text-center text-xs leading-tight font-bold ${won ? 'text-gold' : draw ? 'text-gold-light' : 'text-gold-light/50'}`}>{text}</span>
    </div>
  )
}

/** A mini health bar with Smite's zone at the left end. */
function MiniHealth({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[16%] w-[84%] overflow-hidden rounded border-2 border-gold/60 bg-abyss">
      {children}
      <div className="absolute inset-y-0 left-0 w-[16%] border-r-2 border-gold bg-gold/30" />
    </div>
  )
}

/** The tutorial's health, dropping in small hits and starting over. */
const TUTORIAL_HP = [5400, 5180, 4930, 4760, 4490, 4300, 4020, 3810, 3560, 3330, 3100, 2850, 2640, 2390, 2160, 1940, 1700, 1480, 1230, 990]

function useTickingHp(): number {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setIndex((current) => (current + 1) % TUTORIAL_HP.length), 180)
    return () => window.clearInterval(id)
  }, [])
  return TUTORIAL_HP[index] ?? 0
}

function TickingHealth() {
  const hp = useTickingHp()
  const under = hp <= SMITE_DAMAGE
  return (
    <>
      <span className={`font-mono text-sm font-black tabular-nums sm:text-lg ${under ? 'text-amber-300' : 'text-white'}`}>{formatHp(hp)}</span>
      <MiniHealth>
        {/* On a 10,000 scale, 1,600 is the zone's edge (16%). */}
        <div className={`absolute inset-y-0 left-0 ${under ? 'bg-amber-400' : 'bg-purple-600'}`} style={{ width: percent(hp / 10000) }} />
      </MiniHealth>
    </>
  )
}

/** 1: the health drops in small hits. 2: smite at 1,600 or less. 3: the first smite gets it. */
export function SmiteTutorialArt({ step }: TutorialArtProps) {
  if (step === 0) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-[6%] bg-linear-to-b from-purple-800/45 to-abyss">
        <img src={mapIconUrl('baron')} alt="" className="size-[38%] object-contain" />
        <TickingHealth />
      </div>
    )
  }
  if (step === 1) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-[8%] bg-linear-to-b from-purple-800/45 to-abyss">
        <span className="font-mono text-sm font-black text-amber-300 sm:text-lg">1,480</span>
        <MiniHealth>
          <div className="absolute inset-y-0 left-0 w-[12%] bg-amber-400" />
        </MiniHealth>
        <div className="relative flex size-[34%] items-center justify-center">
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
    <div className="flex size-full flex-col items-center justify-center gap-[7%] bg-linear-to-b from-purple-800/45 to-abyss px-[8%]">
      <TutorialSmiter champion={MINI_GAMES.smite.champion} time="0.28 s" first />
      <TutorialSmiter champion={MINI_GAMES.smite.botChampion} time="0.41 s" first={false} />
    </div>
  )
}

function TutorialSmiter({ champion, time, first }: { champion: string; time: string; first: boolean }) {
  return (
    <div className={`flex w-full items-center gap-[8%] ${first ? '' : 'opacity-50 grayscale'}`}>
      <img src={championIconById(champion)} alt="" className={`aspect-square w-[34%] rounded-full border-2 ${first ? 'border-gold' : 'border-red-400'}`} />
      <span className={`font-display text-xs font-black sm:text-base ${first ? 'text-gold' : 'text-gold-light/70'}`}>
        {time}
        {first && ' ✓'}
      </span>
    </div>
  )
}
