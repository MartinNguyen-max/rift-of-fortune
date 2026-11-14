import { motion } from 'framer-motion'
import { useCallback, useMemo, useRef, useState } from 'react'
import { spellIconUrl } from '../../data'
import {
  DEVOUR,
  devourPoints,
  devourResult,
  devourRockets,
  impactMs,
  NO_DEVOUR,
  rocketProgress,
  type DevourResult,
  type Rocket,
} from '../../game/minigames/devour'
import { other, type Player } from '../../game/minigames/versus'
import { GetReady } from './GetReady'
import { championIconById } from './miniGameArt'
import { BigCall, ContestantTag, Waiting, type Tone } from './parts'
import { sum, useStepFlow } from './stepFlow'
import { useShownWhen, useTimeout } from './timing'
import type { Contestant, MiniGameViewProps, TutorialArtProps } from './types'
import { usePressKey, useStopwatch } from './useStopwatch'

/** Jinx's ult, Super Mega Death Rocket! */
const JINX_ROCKET = spellIconUrl('JinxR.png')
/** Time from your press until the opponent's result shows. */
const REVEAL_MS = 900
/** How long a finished rocket stays up before the next one. */
const BETWEEN_ROCKETS_MS = 2600
/** How long the last rocket's result shows before Victory or Defeat. */
const LAST_ROCKET_MS = 2800
/** The clock stops this long after the impact: the round is over. */
const AFTER_IMPACT_MS = 1400

/** Each champion's save: Tahm devours his carry, Yuumi (the guest in Multiplayer) attaches to them. */
const TAHM_SAVE = { label: 'DEVOUR', icon: spellIconUrl('TahmKenchRWrapper.png') }
const SAVES: Readonly<Record<string, { label: string; icon: string }>> = {
  TahmKench: TAHM_SAVE,
  Yuumi: { label: 'ATTACH', icon: spellIconUrl('YuumiW.png') },
}
const saveOf = (champion: string) => SAVES[champion] ?? TAHM_SAVE

/** Where things stand along the lane, in % of its width. */
const LANE = { jinx: 10, rocketFrom: 16, ally: 70, saver: 85 } as const

/** Tahm Kench vs Yuumi: three rockets at your carry. Save them at the very last moment. */
export function DevourGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const rockets = useMemo(() => devourRockets(setup.seed), [setup.seed])
  const flow = useStepFlow({ moves, me, steps: DEVOUR.rockets, sendMove, revealMs: REVEAL_MS, pauseMs: BETWEEN_ROCKETS_MS })
  useShownWhen(flow.over, onShown, LAST_ROCKET_MS)

  const { step } = flow
  const rocket = rockets[step]
  /** The last rocket whose impact has been shown: scores only count up after it lands. */
  const [landed, setLanded] = useState(-1)
  const land = useCallback(() => setLanded(step), [step])
  const points = useMemo(() => devourPoints(moves, setup.seed), [moves, setup.seed])
  const shownSteps = landed >= step ? step + 1 : step
  const mine = points[me].slice(0, shownSteps)
  const theirs = points[them].slice(0, landed >= step && flow.theirMove !== undefined ? step + 1 : step)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ContestantTag contestant={players[me]} you value={`${sum(mine)}`} />
        <RocketDots current={step} mine={mine} theirs={theirs} />
        <ContestantTag contestant={players[them]} you={false} value={`${sum(theirs)}`} />
      </div>
      {rocket && (
        <DevourRound
          key={step}
          rocket={rocket}
          first={step === 0}
          myMove={flow.myMove}
          theirMove={flow.theirMove}
          waitingFor={flow.waiting ? players[them].name : null}
          me={me}
          players={players}
          onPress={flow.send}
          onLanded={land}
        />
      )}
      <p className="text-center text-xs text-gold-light/60">Tap, click or Space just before the rocket hits</p>
    </div>
  )
}

/** One dot per rocket: gold when you saved better, red when they did. */
function RocketDots({ current, mine, theirs }: { current: number; mine: number[]; theirs: number[] }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Rocket ${current + 1} of ${DEVOUR.rockets}`}>
      {Array.from({ length: DEVOUR.rockets }, (_, index) => {
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

interface DevourRoundProps {
  rocket: Rocket
  /** The first rocket starts after a 3-2-1; the others right away. */
  first: boolean
  /** Your press for this rocket once it is in. */
  myMove: number | undefined
  /** The opponent's press, once it may be shown. */
  theirMove: number | undefined
  waitingFor: string | null
  me: Player
  players: readonly [Contestant, Contestant]
  onPress: (ms: number) => void
  /** The rocket hit: the result may show. */
  onLanded: () => void
}

/**
 * One rocket: Jinx winds up, fires, the rocket speeds up toward your carry, and you save them.
 * The clock keeps running after your press, so you see the rocket land. A round that mounts with
 * your press already in (after a reload) just shows how it ended.
 */
function DevourRound({ rocket, first, myMove, theirMove, waitingFor, me, players, onPress, onLanded }: DevourRoundProps) {
  const [replay] = useState(myMove === undefined)
  const [started, setStarted] = useState(false)
  const [stopped, setStopped] = useState(false)
  const start = useCallback(() => setStarted(true), [])
  const running = replay && started && !stopped
  const { seconds, read } = useStopwatch(running)
  const impact = impactMs(rocket)
  const ms = replay ? seconds * 1000 : impact + AFTER_IMPACT_MS

  const fired = useRef(false)
  const fire = useCallback(
    (value: number) => {
      if (fired.current) return
      fired.current = true
      onPress(value)
    },
    [onPress],
  )
  const canPress = running && myMove === undefined
  const press = useCallback(() => {
    if (canPress) fire(Math.round(read() * 1000))
  }, [canPress, read, fire])
  usePressKey(press, canPress)

  useTimeout(start, 350, replay && !first)
  useTimeout(() => fire(NO_DEVOUR), impact + DEVOUR.graceMs, replay && started)
  useTimeout(onLanded, replay ? impact : 0, !replay || started)
  useTimeout(() => setStopped(true), impact + AFTER_IMPACT_MS, replay && started)

  const result = myMove === undefined ? null : devourResult(rocket, myMove)
  const landed = ms >= impact

  return (
    <div className="flex w-full touch-manipulation flex-col items-center gap-3 select-none" onPointerDown={press}>
      <div className="flex h-24 w-full items-center justify-center overflow-hidden">
        {replay && !started ? (
          first && <GetReady onGo={start} />
        ) : landed && result ? (
          <SaveCall result={result} />
        ) : (
          <WindUp windingUp={ms < rocket.windUpMs} />
        )}
      </div>
      <Lane rocket={rocket} ms={ms} pressedAt={myMove} saver={players[me].champion} />
      <div className="flex h-28 w-full items-center justify-center">
        {myMove === undefined ? (
          <SaveButton champion={players[me].champion} active={canPress} onPress={press} />
        ) : landed && theirMove !== undefined ? (
          <RocketVersus rocket={rocket} myMove={myMove} theirMove={theirMove} me={me} players={players} />
        ) : (
          landed && waitingFor && <Waiting name={waitingFor} />
        )}
      </div>
    </div>
  )
}

/** Above the lane while the rocket is coming: Jinx's battle cry. */
function WindUp({ windingUp }: { windingUp: boolean }) {
  return (
    <motion.p
      key={windingUp ? 'aim' : 'fire'}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`text-center font-display text-lg font-black sm:text-2xl ${windingUp ? 'text-gold-light/70' : 'text-red-400'}`}
    >
      {windingUp ? 'Jinx is aiming…' : 'SUPER MEGA DEATH ROCKET!'}
    </motion.p>
  )
}

interface LaneProps {
  rocket: Rocket
  /** ms since the round started. */
  ms: number
  /** Your press, if it is in. */
  pressedAt: number | undefined
  saver: string
}

/** The lane: Jinx on the left, the rocket flying in, your carry and their saver on the right. */
function Lane({ rocket, ms, pressedAt, saver }: LaneProps) {
  const impact = impactMs(rocket)
  const progress = rocketProgress(rocket, ms)
  const flying = ms >= rocket.windUpMs && ms < impact
  const pressed = pressedAt !== undefined && pressedAt < NO_DEVOUR ? pressedAt : null
  const inside = pressed !== null && ms >= pressed && ms < pressed + DEVOUR.safeMs
  const landed = ms >= impact
  const survived = pressed !== null && impact >= pressed && impact <= pressed + DEVOUR.safeMs
  const rocketAt = LANE.rocketFrom + progress * (LANE.ally - LANE.rocketFrom)

  return (
    <motion.div
      animate={landed && !survived ? { x: [0, -10, 10, -5, 5, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      className="relative h-44 w-full overflow-hidden rounded-lg border-2 border-gold/40 bg-linear-to-b from-sky-950/60 via-emerald-950/40 to-abyss sm:h-52"
    >
      <div className="absolute inset-x-[6%] top-1/2 h-8 -translate-y-1/2 rounded-full border border-dashed border-gold/15 bg-black/20" aria-hidden="true" />
      <motion.img
        src={championIconById('Jinx')}
        alt="Jinx"
        animate={ms < rocket.windUpMs && ms > 0 ? { rotate: [-6, 6, -6] } : { rotate: 0 }}
        transition={{ duration: 0.25, repeat: ms < rocket.windUpMs ? Infinity : 0 }}
        className="absolute top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500 sm:size-14"
        style={{ left: `${LANE.jinx}%` }}
      />
      {flying && (
        <>
          <div
            className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-linear-to-r from-transparent via-orange-500/50 to-orange-300"
            style={{ left: `${LANE.rocketFrom}%`, width: `${rocketAt - LANE.rocketFrom}%` }}
            aria-hidden="true"
          />
          <img
            src={JINX_ROCKET}
            alt=""
            draggable={false}
            className="absolute top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-orange-300 shadow-[0_0_20px_rgb(251_146_60)] sm:size-12"
            style={{ left: `${rocketAt}%` }}
          />
        </>
      )}
      <motion.div
        animate={inside ? { left: `${LANE.saver}%`, scale: 0, opacity: 0 } : { left: `${LANE.ally}%`, scale: 1, opacity: 1 }}
        transition={{ duration: 0.12 }}
        className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      >
        <img
          src={championIconById(rocket.ally)}
          alt={rocket.ally}
          draggable={false}
          className={`size-12 rounded-full border-2 border-hextech sm:size-14 ${landed && !survived ? 'grayscale' : ''}`}
        />
        {landed && !survived && <span className="absolute -top-3 text-2xl">💀</span>}
      </motion.div>
      <motion.img
        src={championIconById(saver)}
        alt=""
        draggable={false}
        animate={inside ? { scale: [1, 1.25, 1.15] } : { scale: 1 }}
        transition={{ duration: 0.25 }}
        className="absolute top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-hextech shadow-[0_0_18px_rgb(10_200_185/0.5)] sm:size-20"
        style={{ left: `${LANE.saver}%` }}
      />
      {landed && (
        <motion.span
          initial={{ scale: 0.2, opacity: 1 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="pointer-events-none absolute top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400/80"
          style={{ left: `${LANE.ally}%` }}
          aria-hidden="true"
        />
      )}
    </motion.div>
  )
}

const CALLS: Record<DevourResult['outcome'], { text: string; tone: Tone }> = {
  perfect: { text: 'PERFECT!', tone: 'win' },
  saved: { text: 'SAVED!', tone: 'you' },
  early: { text: 'SPAT OUT!', tone: 'lose' },
  late: { text: 'TOO LATE!', tone: 'lose' },
}

/** Your result, huge: saved or not, and the points. */
function SaveCall({ result }: { result: DevourResult }) {
  const { text, tone } = CALLS[result.outcome]
  const sub =
    result.outcome === 'early'
      ? 'Too early: they popped out before it hit'
      : result.margin !== null && result.margin >= 0
        ? `${result.margin} ms before the hit · +${result.points}`
        : undefined
  return <BigCall text={text} tone={tone} sub={sub} size="large" />
}

function SaveButton({ champion, active, onPress }: { champion: string; active: boolean; onPress: () => void }) {
  const { label, icon } = saveOf(champion)
  return (
    <motion.button
      type="button"
      aria-label={label}
      disabled={!active}
      onClick={onPress}
      whileTap={{ scale: 0.88 }}
      className="relative flex size-28 touch-manipulation items-center justify-center overflow-hidden rounded-full border-4 border-hextech bg-abyss shadow-lg shadow-cyan-500/40 disabled:opacity-40"
    >
      <img src={icon} alt="" draggable={false} className="absolute inset-0 size-full object-cover opacity-80" />
      <span className="relative font-display text-xl font-black text-white drop-shadow-[0_2px_4px_black]">{label}</span>
    </motion.button>
  )
}

interface RocketVersusProps {
  rocket: Rocket
  myMove: number
  theirMove: number
  me: Player
  players: readonly [Contestant, Contestant]
}

/** Both points for the rocket side by side, the higher one in gold. */
function RocketVersus({ rocket, myMove, theirMove, me, players }: RocketVersusProps) {
  const mine = devourResult(rocket, myMove).points
  const theirs = devourResult(rocket, theirMove).points
  return (
    <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="grid w-full max-w-xs grid-cols-[1fr_auto_1fr] items-center gap-3" aria-live="polite">
      <VersusSide contestant={players[me]} you points={mine} best={mine > theirs} />
      <span className="font-display text-lg text-gold/60">vs</span>
      <VersusSide contestant={players[other(me)]} you={false} points={theirs} best={theirs > mine} />
    </motion.div>
  )
}

function VersusSide({ contestant, you, points, best }: { contestant: Contestant; you: boolean; points: number; best: boolean }) {
  const color = best ? 'text-gold' : you ? 'text-hextech' : 'text-red-400'
  return (
    <div className={`flex items-center gap-2 ${you ? 'justify-end' : 'flex-row-reverse justify-end'}`}>
      <img src={championIconById(contestant.champion)} alt={contestant.name} className={`size-10 rounded-full border-2 ${you ? 'border-hextech' : 'border-red-400'}`} />
      <span className={`font-display text-4xl font-black tabular-nums ${color}`}>{points}</span>
    </div>
  )
}

/** 1: Jinx fires, the rocket speeds up. 2: Tahm swallows the carry as it hits. 3: closer = more points. */
export function DevourTutorialArt({ step }: TutorialArtProps) {
  const backdrop = 'bg-linear-to-b from-sky-950/70 via-emerald-950/50 to-abyss'
  if (step === 0) {
    return (
      <div className={`relative size-full ${backdrop}`}>
        <img src={championIconById('Jinx')} alt="" className="absolute top-1/2 left-[14%] size-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500" />
        <motion.img
          src={JINX_ROCKET}
          alt=""
          animate={{ left: ['26%', '34%', '80%'], opacity: [1, 1, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, times: [0, 0.55, 1], ease: 'easeIn' }}
          className="absolute top-1/2 size-[20%] -translate-x-1/2 -translate-y-1/2 rounded border border-orange-300"
        />
        <img src={championIconById('Ezreal')} alt="" className="absolute top-1/2 left-[86%] size-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-hextech" />
      </div>
    )
  }
  if (step === 1) {
    return (
      <div className={`relative size-full ${backdrop}`}>
        <motion.img
          src={championIconById('Ezreal')}
          alt=""
          animate={{ left: ['40%', '40%', '68%', '68%', '40%'], scale: [1, 1, 0, 0, 1], opacity: [1, 1, 0, 0, 1] }}
          transition={{ duration: 2, repeat: Infinity, times: [0, 0.3, 0.4, 0.75, 0.85] }}
          className="absolute top-1/2 size-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-hextech"
        />
        <motion.img
          src={championIconById('TahmKench')}
          alt=""
          animate={{ scale: [1, 1, 1.25, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, times: [0, 0.3, 0.4, 0.75, 0.85] }}
          className="absolute top-1/2 left-[70%] size-[36%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-hextech"
        />
        <motion.span
          animate={{ scale: [0, 0, 2, 0], opacity: [0, 0, 0.9, 0] }}
          transition={{ duration: 2, repeat: Infinity, times: [0, 0.5, 0.6, 0.7] }}
          className="absolute top-1/2 left-[40%] size-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400"
        />
      </div>
    )
  }
  return (
    <div className={`flex size-full flex-col items-center justify-center gap-[6%] font-display font-black ${backdrop}`}>
      <span className="text-sm text-gold sm:text-xl">+100</span>
      <span className="text-xs text-hextech sm:text-base">+60</span>
      <span className="text-[10px] text-red-400 sm:text-sm">early ✕</span>
    </div>
  )
}
