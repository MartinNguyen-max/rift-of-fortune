import { motion } from 'framer-motion'
import { useCallback, useId, useMemo, useState, type ReactNode } from 'react'
import { championIconUrl, gameData, spellIconUrl } from '../../data'
import {
  botGoldAt,
  botGrabs,
  FIELD,
  HOOK,
  HOOK_ORIGIN,
  HOOK_SECONDS,
  hookField,
  hookTip,
  type HookTarget,
} from '../../game/minigames/hook'
import { other } from '../../game/minigames/versus'
import { GetReady } from './GetReady'
import { recentGrabs, useHookRun, type Grab, type HookFrame, type HookRunEnd } from './hookScreen'
import { championIconById } from './miniGameArt'
import { BigCall, ContestantTag, Waiting } from './parts'
import { useShownWhen, useTimeout } from './timing'
import type { Contestant, MiniGameViewProps, TutorialArtProps } from './types'

/** Seconds a "+300g" floats up before it is gone. */
const POPUP_SECONDS = 0.9
/** Seconds ACE! or TIME! stays up alone before both totals show. */
const CALL_SECONDS = { ace: 1.6, time: 0.8 }
/** Ms both totals stay up before the result covers the game. */
const TALLY_MS = 1500
/** The clock turns red for the last seconds. */
const HURRY_SECONDS = 5

const GOLD = '#c8aa6e'
const GOLD_LIGHT = '#f0e6d2'
const CARRY_GOLD = '#f5d76e'
const HEXTECH = '#0ac8b9'

/** Blitzcrank's icon radius and the cooldown ring around it, in field units. */
const BLITZ_RADIUS = 5.5
const RING_RADIUS = 6.6
/** The Rocket Grab icon sits right next to Blitzcrank. */
const ROCKET_GRAB = { x: HOOK_ORIGIN.x + 9, y: HOOK_ORIGIN.y - 5.5, size: 11 } as const
/** Your "+300g" pops up left of Blitzcrank, where the grabs land. */
const POPUP_SPOT = { x: HOOK_ORIGIN.x - 14, y: HOOK_ORIGIN.y + 2 } as const

/** Rocket Grab Gold Rush: Gold Miner with Blitzcrank's hook. Most gold when the clock runs out wins. */
export function HookGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const duration = HOOK_SECONDS[setup.variant]
  const field = useMemo(() => hookField(setup.seed, gameData.champions), [setup.seed])
  const vsBot = players[them].isBot
  const botPlan = useMemo(() => (vsBot ? botGrabs(field, setup.seed, duration) : []), [vsBot, field, setup.seed, duration])
  const [started, setStarted] = useState(false)
  const start = useCallback(() => setStarted(true), [])
  const myMove = moves[me][0]
  const theirMove = moves[them][0]

  const sendGold = useCallback(({ gold }: HookRunEnd) => sendMove(0, gold), [sendMove])
  const run = useHookRun({ field, duration, active: started && myMove === undefined, onEnd: sendGold })
  const over = run.ended !== null || myMove !== undefined
  const ace = run.ended?.ace ?? false

  const [callDone, setCallDone] = useState(false)
  useTimeout(() => setCallDone(true), (ace ? CALL_SECONDS.ace : CALL_SECONDS.time) * 1000, over)
  const totalsKnown = callDone && myMove !== undefined && theirMove !== undefined
  useShownWhen(totalsKnown, onShown, TALLY_MS)

  // The bot's gold rises live; a Multiplayer opponent's stays hidden until your time is up.
  const theirGold = over ? theirMove : vsBot ? botGoldAt(botPlan, run.now) : undefined

  return (
    <div className="flex flex-col gap-3">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ContestantTag contestant={players[me]} you value={`${myMove ?? run.frame.gold}g`} />
        <GameClock left={duration - run.now} total={duration} />
        <div className="relative min-w-0">
          <ContestantTag contestant={players[them]} you={false} value={theirGold === undefined ? '?' : `${theirGold}g`} />
          {!over && <OpponentPopups grabs={recentGrabs(botPlan, run.now, POPUP_SECONDS)} />}
        </div>
      </div>

      <HookField frame={run.frame} popups={recentGrabs(run.grabs, run.now, POPUP_SECONDS)} denied={run.denied} onFire={run.fire}>
        {!started && !over && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-abyss/50">
            <GetReady onGo={start} />
          </div>
        )}
        {over && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-lg bg-abyss/55 p-2">
            <BigCall
              text={ace ? 'ACE!' : 'TIME!'}
              tone={ace ? 'win' : 'plain'}
              size={ace ? 'huge' : 'large'}
              sub={ace && !callDone ? 'Every champion grabbed' : undefined}
            />
            {callDone &&
              (myMove !== undefined && theirMove !== undefined ? (
                <Totals you={players[me]} opponent={players[them]} mine={myMove} theirs={theirMove} />
              ) : (
                <div className="rounded bg-abyss/80 px-2 py-1">
                  <Waiting name={players[them].name} />
                </div>
              ))}
          </div>
        )}
      </HookField>

      <p className="min-h-4 text-center text-xs text-gold-light/60">
        {!over && run.shotsFired === 0 && 'Tap or press Space to fire'}
      </p>
    </div>
  )
}

/** The big clock between the two gold tags, red for the last seconds. */
function GameClock({ left, total }: { left: number; total: number }) {
  const hurry = left <= HURRY_SECONDS
  return (
    <div className="flex w-24 flex-col items-center gap-1 sm:w-36" role="timer" aria-label={`${Math.ceil(left)} seconds left`}>
      <span className={`font-mono text-3xl leading-none font-black tabular-nums ${hurry ? 'text-red-400' : 'text-gold-light'}`}>
        {left.toFixed(1)}
      </span>
      <div className="h-2 w-full overflow-hidden rounded-full bg-abyss/80">
        <div className={`h-full rounded-full ${hurry ? 'bg-red-400' : 'bg-hextech'}`} style={{ width: `${(left / total) * 100}%` }} />
      </div>
    </div>
  )
}

interface HookFieldProps {
  frame: HookFrame
  /** Your grabs that just landed. */
  popups: readonly Grab[]
  /** Taps while Rocket Grab wasn't ready. */
  denied: number
  onFire: () => void
  /** Overlays: the countdown, the end. */
  children: ReactNode
}

/** The field from Blitzcrank's point of view. Tap anywhere on it to fire. */
function HookField({ frame, popups, denied, onFire, children }: HookFieldProps) {
  const id = useId()
  const clip = `${id}-circle`
  const { angle, length, carried, remaining, cooldownLeft } = frame
  const tip = hookTip(angle, length)
  const aim = hookTip(angle, 16)

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Fire Rocket Grab"
      onPointerDown={onFire}
      className="relative w-full cursor-crosshair touch-manipulation select-none"
    >
      <svg viewBox={`0 0 ${FIELD.width} ${FIELD.height}`} className="block w-full rounded-lg border-2 border-gold/40" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-ground`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0f2a2a" />
            <stop offset="0.45" stopColor="#163a26" />
            <stop offset="1" stopColor="#0b1f14" />
          </linearGradient>
          <clipPath id={clip} clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.5" />
          </clipPath>
          <filter id={`${id}-grey`}>
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width={FIELD.width} height={FIELD.height} fill={`url(#${id}-ground)`} />
        <path d="M0 30 Q 30 24 50 31 T 100 28 L100 36 Q 70 32 50 38 T 0 37 Z" fill="#1c4e66" opacity="0.35" />
        <Bushes />
        <rect width={FIELD.width} height="13" fill="#0a1428" opacity="0.85" />
        <RocketGrabIcon cooldownLeft={cooldownLeft} denied={denied} greyFilter={`${id}-grey`} />

        {cooldownLeft === 0 && (
          <line
            x1={HOOK_ORIGIN.x}
            y1={HOOK_ORIGIN.y}
            x2={aim.x}
            y2={aim.y}
            stroke={GOLD_LIGHT}
            strokeWidth="0.3"
            strokeDasharray="1 1.2"
            opacity="0.5"
          />
        )}
        {remaining.map((target) => (
          <Target key={target.id} target={target} clip={clip} />
        ))}
        <line x1={HOOK_ORIGIN.x} y1={HOOK_ORIGIN.y} x2={tip.x} y2={tip.y} stroke={GOLD} strokeWidth="0.7" strokeDasharray="1.4 0.6" />
        {carried && <Target target={{ ...carried, ...tip, y: tip.y + carried.radius * 0.8 }} clip={clip} />}
        <g transform={`translate(${tip.x} ${tip.y}) rotate(${-angle})`}>
          <path d="M-2 0 L-1.4 2.2 M2 0 L1.4 2.2 M-2 0 H2" stroke={GOLD_LIGHT} strokeWidth="0.7" fill="none" strokeLinecap="round" />
        </g>
        <Blitzcrank clip={clip} cooldownLeft={cooldownLeft} />
      </svg>

      <GoldPopups grabs={popups} />
      {children}
    </div>
  )
}

/** Blitzcrank, ringed by a bar that fills while Rocket Grab cools down and glows once it is ready. */
function Blitzcrank({ clip, cooldownLeft }: { clip: string; cooldownLeft: number | null }) {
  const { x, y } = HOOK_ORIGIN
  const ready = cooldownLeft === 0
  const charge = cooldownLeft === null ? 0 : 1 - cooldownLeft / HOOK.cooldown
  return (
    <g>
      <circle cx={x} cy={y} r={RING_RADIUS} fill="none" stroke="#010a13" strokeWidth="1.4" opacity="0.85" />
      {ready && <circle cx={x} cy={y} r={RING_RADIUS} fill="none" stroke={HEXTECH} strokeWidth="2.6" opacity="0.4" className="animate-pulse" />}
      <circle
        cx={x}
        cy={y}
        r={RING_RADIUS}
        fill="none"
        stroke={ready ? HEXTECH : '#6b8a93'}
        strokeWidth="1.2"
        pathLength={1}
        strokeDasharray={`${charge} 1`}
        transform={`rotate(-90 ${x} ${y})`}
      />
      <image
        href={championIconById('Blitzcrank')}
        x={x - BLITZ_RADIUS}
        y={y - BLITZ_RADIUS}
        width={BLITZ_RADIUS * 2}
        height={BLITZ_RADIUS * 2}
        clipPath={`url(#${clip})`}
      />
      <circle cx={x} cy={y} r={BLITZ_RADIUS} fill="none" stroke={GOLD} strokeWidth="0.6" />
    </g>
  )
}

/** Two mirrored shakes, so every early tap changes the target and plays one. */
const SHAKE_LEFT = [0, -1.2, 1.2, -0.8, 0.8, 0]
const SHAKE_RIGHT = [0, 1.2, -1.2, 0.8, -0.8, 0]

interface RocketGrabIconProps {
  cooldownLeft: number | null
  denied: number
  greyFilter: string
}

/**
 * Rocket Grab, big and right next to Blitzcrank: glowing when ready, grey with the seconds left
 * while it cools down. It shakes when you tap too early. Drawn under the hook so it never hides it.
 */
function RocketGrabIcon({ cooldownLeft, denied, greyFilter }: RocketGrabIconProps) {
  const { x, y, size } = ROCKET_GRAB
  const ready = cooldownLeft === 0
  return (
    <motion.g initial={false} animate={{ x: denied % 2 === 0 ? SHAKE_LEFT : SHAKE_RIGHT }} transition={{ duration: 0.3 }}>
      {ready && (
        <rect
          x={x - 1}
          y={y - 1}
          width={size + 2}
          height={size + 2}
          rx="2"
          fill="none"
          stroke={HEXTECH}
          strokeWidth="1.6"
          opacity="0.5"
          className="animate-pulse"
        />
      )}
      <image
        href={spellIconUrl('RocketGrab.png')}
        x={x}
        y={y}
        width={size}
        height={size}
        filter={ready ? undefined : `url(#${greyFilter})`}
        opacity={ready ? 1 : 0.45}
      />
      <rect x={x} y={y} width={size} height={size} rx="1" fill="none" stroke={ready ? HEXTECH : GOLD} strokeWidth="0.6" opacity={ready ? 1 : 0.5} />
      {cooldownLeft !== null && cooldownLeft > 0 && (
        <text
          x={x + size / 2}
          y={y + size / 2 + 1.6}
          textAnchor="middle"
          fontSize="4.6"
          fontWeight="900"
          fill={GOLD_LIGHT}
          className="font-mono"
        >
          {cooldownLeft.toFixed(1)}
        </text>
      )}
    </motion.g>
  )
}

/** "+300g" floating up next to Blitzcrank as the gold lands. Nothing for a miss. */
function GoldPopups({ grabs }: { grabs: readonly Grab[] }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: `${(POPUP_SPOT.x / FIELD.width) * 100}%`, top: `${(POPUP_SPOT.y / FIELD.height) * 100}%` }}
      aria-live="polite"
    >
      {grabs.map(({ at, target }) => (
        <motion.span
          key={at}
          initial={{ y: 0, opacity: 1, scale: 0.7 }}
          animate={{ y: -26, opacity: [1, 1, 0], scale: 1 }}
          transition={{ duration: POPUP_SECONDS, ease: 'easeOut' }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 font-display font-black whitespace-nowrap drop-shadow-[0_1px_3px_rgb(0_0_0/0.9)] ${
            target.kind === 'minion' ? 'text-sm text-gold-light/70' : 'text-lg text-gold sm:text-2xl'
          }`}
        >
          +{target.value}g
        </motion.span>
      ))}
    </div>
  )
}

/** The bot's grabs: a tiny "+250g" by its tag, out of the way. */
function OpponentPopups({ grabs }: { grabs: readonly Grab[] }) {
  return grabs.map(({ at, target }) => (
    <motion.span
      key={at}
      initial={{ y: 2, opacity: 0 }}
      animate={{ y: -6, opacity: [0, 1, 0] }}
      transition={{ duration: POPUP_SECONDS }}
      className="pointer-events-none absolute right-11 bottom-full text-xs font-bold whitespace-nowrap text-red-400"
      aria-hidden="true"
    >
      +{target.value}g
    </motion.span>
  ))
}

interface TotalsProps {
  you: Contestant
  opponent: Contestant
  mine: number
  theirs: number
}

/** Both totals side by side; the winner's glows. */
function Totals({ you, opponent, mine, theirs }: TotalsProps) {
  const youWon = mine > theirs
  const theyWon = theirs > mine
  return (
    <div className="flex items-center gap-5 sm:gap-8" role="status">
      <GoldTotal contestant={you} you gold={mine} won={youWon} lost={theyWon} />
      <span className="font-display text-sm font-black text-gold-light/60">VS</span>
      <GoldTotal contestant={opponent} you={false} gold={theirs} won={theyWon} lost={youWon} />
    </div>
  )
}

interface GoldTotalProps {
  contestant: Contestant
  you: boolean
  gold: number
  won: boolean
  lost: boolean
}

function GoldTotal({ contestant, you, gold, won, lost }: GoldTotalProps) {
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: won ? 1.15 : 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 14 }}
      className={`flex min-w-0 flex-col items-center rounded-lg border-2 bg-abyss px-3 py-1.5 ${
        won ? 'border-gold shadow-[0_0_24px_rgb(200_170_110/0.8)]' : 'border-gold/30'
      } ${lost ? '*:opacity-50' : ''}`}
    >
      <img
        src={championIconById(contestant.champion)}
        alt=""
        className={`size-9 rounded-full border-2 sm:size-12 ${you ? 'border-hextech' : 'border-red-400'}`}
      />
      <span className={`max-w-24 truncate text-[11px] font-semibold ${you ? 'text-hextech' : 'text-red-400'}`}>{contestant.name}</span>
      <span className={`font-display text-2xl font-black sm:text-3xl ${won ? 'text-gold' : 'text-gold-light'}`}>{gold}g</span>
    </motion.div>
  )
}

function Target({ target, clip }: { target: HookTarget; clip: string }) {
  const { x, y, radius, champion, value } = target
  return (
    <g>
      {champion ? (
        <>
          <image
            href={championIconUrl(champion.image)}
            x={x - radius}
            y={y - radius}
            width={radius * 2}
            height={radius * 2}
            clipPath={`url(#${clip})`}
          />
          <circle cx={x} cy={y} r={radius} fill="none" stroke={value >= 250 ? CARRY_GOLD : GOLD} strokeWidth="0.5" />
        </>
      ) : (
        <MinionShape x={x} y={y} radius={radius} />
      )}
      <text
        x={x}
        y={y + radius + 2.5}
        textAnchor="middle"
        fontSize={champion ? 2.4 : 2}
        fill={GOLD_LIGHT}
        fontWeight={champion ? 700 : 400}
        opacity={champion ? 1 : 0.7}
      >
        {value}g
      </text>
    </g>
  )
}

/** A red-side caster minion, drawn in SVG. */
function MinionShape({ x, y, radius }: { x: number; y: number; radius: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={radius} fill="#5b1f2a" stroke="#c0392b" strokeWidth="0.5" />
      <path d={`M${x - radius * 0.7} ${y - radius * 0.2} L${x} ${y - radius * 1.25} L${x + radius * 0.7} ${y - radius * 0.2} Z`} fill="#8e2c3a" />
      <circle cx={x - radius * 0.32} cy={y + radius * 0.1} r={radius * 0.16} fill="#ffd166" />
      <circle cx={x + radius * 0.32} cy={y + radius * 0.1} r={radius * 0.16} fill="#ffd166" />
    </g>
  )
}

const BUSHES = [
  [12, 20, 7],
  [88, 22, 6],
  [30, 62, 8],
  [72, 64, 9],
  [52, 45, 5],
] as const

function Bushes() {
  return (
    <g opacity="0.45">
      {BUSHES.map(([x, y, size]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={size} ry={size * 0.45} fill="#2f6b3a" />
      ))}
    </g>
  )
}

/** 1: the swinging hook and a tap. 2: a carry pays 300g, a minion 20g. 3: gold against the clock. */
export function HookTutorialArt({ step }: TutorialArtProps) {
  if (step === 0) return <SwingArt />
  if (step === 1) return <ValueArt />
  return <ClockArt />
}

function SwingArt() {
  return (
    <div className="relative size-full overflow-hidden bg-linear-to-b from-[#0f2a2a] to-[#0b1f14]">
      <motion.div
        className="absolute top-[22%] left-1/2 h-[56%] w-0 origin-top border-l-2 border-dashed border-gold"
        animate={{ rotate: [-50, 50, -50] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="absolute -bottom-1 -left-[5px] size-2 rounded-full bg-gold-light" />
      </motion.div>
      <img
        src={championIconById('Blitzcrank')}
        alt=""
        className="absolute top-[6%] left-1/2 size-[32%] -translate-x-1/2 rounded-full border-2 border-hextech"
      />
      <motion.span
        className="absolute right-[6%] bottom-[4%] text-2xl sm:text-3xl"
        animate={{ scale: [1, 0.8, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        👆
      </motion.span>
    </div>
  )
}

function ValueArt() {
  return (
    <div className="flex size-full items-center justify-around bg-linear-to-b from-[#163a26] to-[#0b1f14] px-1">
      <div className="flex flex-col items-center gap-1">
        <motion.img
          src={championIconById('Jinx')}
          alt=""
          className="size-10 rounded-full border-2 border-[#f5d76e] sm:size-14"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
        <span className="font-display text-sm font-black text-gold sm:text-lg">300g</span>
      </div>
      <div className="flex flex-col items-center gap-1 opacity-60">
        <svg viewBox="-4.5 -5.5 9 10" className="size-6 sm:size-9">
          <MinionShape x={0} y={0} radius={4} />
        </svg>
        <span className="text-[10px] font-semibold text-gold-light/70 sm:text-xs">20g</span>
      </div>
    </div>
  )
}

const COINS = 4

function ClockArt() {
  return (
    <div className="flex size-full items-center justify-center gap-[10%] bg-linear-to-b from-[#163a26] to-[#0b1f14]">
      <div className="relative size-[36%] rounded-full border-[3px] border-gold-light/80 bg-abyss/60">
        <span className="absolute -top-[22%] left-[38%] h-[16%] w-[24%] rounded-sm bg-gold-light/80" />
        <motion.span
          className="absolute bottom-1/2 left-[calc(50%-1px)] h-[40%] w-0.5 origin-bottom rounded bg-red-400"
          animate={{ rotate: 360 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
        />
      </div>
      <div className="relative h-[46%] w-[34%]">
        {Array.from({ length: COINS }, (_, index) => {
          const drop = 0.1 + index * 0.15
          return (
            <motion.span
              key={index}
              className="absolute inset-x-0 h-[26%] rounded-[50%] border border-yellow-700 bg-linear-to-b from-yellow-200 to-yellow-500"
              style={{ bottom: `${index * 22}%` }}
              animate={{ y: [-14, -14, 0, 0, 0], opacity: [0, 0, 1, 1, 0] }}
              transition={{ duration: 2.4, times: [0, drop, drop + 0.1, 0.9, 1], repeat: Infinity }}
            />
          )
        })}
      </div>
    </div>
  )
}
