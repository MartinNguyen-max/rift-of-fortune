import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { championIconUrl, gameData, spellIconUrl } from '../../data'
import { winnerByScore } from '../../game/minigames/catalog'
import {
  botGoldAt,
  botGrabs,
  FIELD,
  fireHook,
  HOOK,
  HOOK_ORIGIN,
  hookField,
  hookGold,
  hookTip,
  swingAngle,
  type HookShot,
  type HookTarget,
} from '../../game/minigames/hook'
import { usePressKey, useStopwatch } from '../multiplayer/games/useStopwatch'
import { GetReady } from '../multiplayer/games/GetReady'
import type { MiniGameProps } from './MiniGameShell'
import { championIconById } from './miniGameArt'

/** Swinging, or a shot in the air. Swing time only runs while swinging, so the swing resumes where it stopped. */
type HookState =
  | { mode: 'swinging'; swingTime: number; since: number }
  | { mode: 'flying'; swingTime: number; shot: HookShot; firedAt: number }

interface Popup {
  id: number
  text: string
  good: boolean
}

const MINION_LINES = ['A minion. Classic Blitz.', 'Caster minion secured. Great hook.', 'Hooked a minion. Support diff.']

/** Rocket Grab Gold Rush: Gold Miner with Blitzcrank's hook. */
export function HookGame({ seed, onFinish }: MiniGameProps) {
  const field = useMemo(() => hookField(seed, gameData.champions), [seed])
  const bot = useMemo(() => botGrabs(field, seed), [field, seed])
  const [started, setStarted] = useState(false)
  const [remaining, setRemaining] = useState(field)
  const [grabbed, setGrabbed] = useState<HookTarget[]>([])
  const [hook, setHook] = useState<HookState>({ mode: 'swinging', swingTime: 0, since: 0 })
  const [readyAt, setReadyAt] = useState(0)
  const [popup, setPopup] = useState<Popup | null>(null)
  const [over, setOver] = useState(false)
  const { seconds, read } = useStopwatch(started && !over)
  const clipId = useId()
  const landing = useRef<number | null>(null)
  /** Gold banked so far, for the timer that ends the game. */
  const banked = useRef(0)
  const finished = useRef(false)

  const gold = hookGold(grabbed)
  const championsLeft = remaining.some((target) => target.kind === 'champion')
  const botGold = botGoldAt(bot, seconds)
  const timeLeft = Math.max(0, HOOK.duration - seconds)

  const end = useCallback(
    (finalGold: number) => {
      if (finished.current) return
      finished.current = true
      setOver(true)
      if (landing.current !== null) window.clearTimeout(landing.current)
      const botTotal = botGoldAt(bot, HOOK.duration)
      onFinish({ winner: winnerByScore(finalGold, botTotal), player: `${finalGold} gold`, bot: `${botTotal} gold` })
    },
    [bot, onFinish],
  )

  // The timer: anything still on the hook when it runs out doesn't count.
  useEffect(() => {
    if (!started) return
    const id = window.setTimeout(() => end(banked.current), HOOK.duration * 1000)
    return () => window.clearTimeout(id)
  }, [started, end])

  const land = useCallback((shot: HookShot, at: number) => {
    landing.current = null
    setHook((state) => ({ mode: 'swinging', swingTime: state.swingTime, since: at }))
    setReadyAt(at + HOOK.cooldown)
    const { target } = shot
    if (!target) {
      setPopup({ id: at, text: 'Missed!', good: false })
      return
    }
    banked.current += target.value
    setRemaining((targets) => targets.filter((other) => other !== target))
    setGrabbed((done) => [...done, target])
    const text =
      target.kind === 'minion'
        ? (MINION_LINES[Math.floor(at) % MINION_LINES.length] ?? MINION_LINES[0] ?? '')
        : `${target.champion?.name ?? 'Champion'} +${target.value}g`
    setPopup({ id: at, text, good: target.kind === 'champion' })
  }, [])

  const fire = useCallback(() => {
    const now = read()
    if (!started || over || hook.mode !== 'swinging' || now < readyAt) return
    const swingTime = hook.swingTime + (now - hook.since)
    const shot = fireHook(remaining, swingAngle(swingTime))
    setHook({ mode: 'flying', swingTime, shot, firedAt: now })
    const flight = shot.outTime + shot.backTime
    landing.current = window.setTimeout(() => land(shot, now + flight), flight * 1000)
  }, [started, over, hook, readyAt, remaining, read, land])
  usePressKey(fire, started && !over)

  useEffect(() => () => {
    if (landing.current !== null) window.clearTimeout(landing.current)
  }, [])

  // Every champion grabbed: the round ends with the gold so far.
  useEffect(() => {
    if (started && !over && !championsLeft && hook.mode === 'swinging') {
      const id = window.setTimeout(() => end(banked.current), 400)
      return () => window.clearTimeout(id)
    }
  }, [started, over, championsLeft, hook.mode, end])

  const { angle, length, carried } = hookPose(hook, seconds)
  const tip = hookTip(angle, length)
  /** Null while the hook is out. */
  const cooldownLeft = hook.mode === 'swinging' ? Math.max(0, readyAt - seconds) : null
  const lastBotGrab = bot.findLast(({ at }) => at <= seconds)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <GoldTag icon={championIconById('Blitzcrank')} label="You" gold={gold} />
        <div className="flex flex-1 flex-col items-center gap-1">
          <span className={`font-mono text-lg font-bold ${timeLeft < 5 ? 'text-red-400' : 'text-gold-light'}`}>
            {timeLeft.toFixed(1)}s
          </span>
          <div className="h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-abyss">
            <div className="h-full bg-hextech" style={{ width: `${(timeLeft / HOOK.duration) * 100}%` }} />
          </div>
        </div>
        <GoldTag icon={championIconById('Thresh')} label="Thresh" gold={botGold} right />
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${FIELD.width} ${FIELD.height}`}
          className="w-full cursor-crosshair touch-manipulation rounded-lg border-2 border-gold/40 select-none"
          onPointerDown={fire}
          role="button"
          aria-label="Fire Rocket Grab"
        >
          <defs>
            <linearGradient id={`${clipId}-ground`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0f2a2a" />
              <stop offset="0.45" stopColor="#163a26" />
              <stop offset="1" stopColor="#0b1f14" />
            </linearGradient>
            <clipPath id={`${clipId}-circle`} clipPathUnits="objectBoundingBox">
              <circle cx="0.5" cy="0.5" r="0.5" />
            </clipPath>
          </defs>
          <rect width={FIELD.width} height={FIELD.height} fill={`url(#${clipId}-ground)`} />
          <path d="M0 30 Q 30 24 50 31 T 100 28 L100 36 Q 70 32 50 38 T 0 37 Z" fill="#1c4e66" opacity="0.35" />
          <Bushes />
          <rect width={FIELD.width} height="13" fill="#0a1428" opacity="0.85" />

          {hook.mode === 'swinging' && cooldownLeft === 0 && (
            <line
              x1={HOOK_ORIGIN.x}
              y1={HOOK_ORIGIN.y}
              x2={hookTip(angle, 16).x}
              y2={hookTip(angle, 16).y}
              stroke="#f0e6d2"
              strokeWidth="0.3"
              strokeDasharray="1 1.2"
              opacity="0.5"
            />
          )}

          {remaining.map((target) =>
            target === carried ? null : <Target key={target.id} target={target} clip={`${clipId}-circle`} />,
          )}

          <line
            x1={HOOK_ORIGIN.x}
            y1={HOOK_ORIGIN.y}
            x2={tip.x}
            y2={tip.y}
            stroke="#c8aa6e"
            strokeWidth="0.7"
            strokeDasharray="1.4 0.6"
          />
          {carried && <Target target={{ ...carried, ...tip, y: tip.y + carried.radius * 0.8 }} clip={`${clipId}-circle`} />}
          <g transform={`translate(${tip.x} ${tip.y}) rotate(${-angle})`}>
            <path d="M-2 0 L-1.4 2.2 M2 0 L1.4 2.2 M-2 0 H2" stroke="#f0e6d2" strokeWidth="0.7" fill="none" strokeLinecap="round" />
          </g>
          <image
            href={championIconById('Blitzcrank')}
            x={HOOK_ORIGIN.x - 5.5}
            y={HOOK_ORIGIN.y - 5.5}
            width="11"
            height="11"
            clipPath={`url(#${clipId}-circle)`}
          />
          <circle cx={HOOK_ORIGIN.x} cy={HOOK_ORIGIN.y} r="5.5" fill="none" stroke="#c8aa6e" strokeWidth="0.6" />
        </svg>

        <RocketGrabIcon cooldownLeft={cooldownLeft} />
        <AnimatePresence>
          {popup && (
            <motion.p
              key={popup.id}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`pointer-events-none absolute top-[22%] left-1/2 -translate-x-1/2 rounded bg-abyss/80 px-3 py-1 font-display text-lg font-black whitespace-nowrap ${
                popup.good ? 'text-gold' : 'text-gold-light/70'
              }`}
            >
              {popup.text}
            </motion.p>
          )}
        </AnimatePresence>
        {!started && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-abyss/50">
            <GetReady onGo={() => setStarted(true)} />
          </div>
        )}
      </div>

      <p className="min-h-5 text-center text-xs text-gold-light/60">
        {lastBotGrab
          ? `Thresh hooked ${lastBotGrab.target.champion?.name ?? 'a minion'} (+${lastBotGrab.target.value}g)`
          : 'Click, tap or press Space to fire Rocket Grab.'}
      </p>
    </div>
  )
}

/** Where the hook is this frame and what it carries. */
function hookPose(hook: HookState, seconds: number): { angle: number; length: number; carried: HookTarget | null } {
  if (hook.mode === 'swinging') {
    return { angle: swingAngle(hook.swingTime + Math.max(0, seconds - hook.since)), length: 4, carried: null }
  }
  const { shot } = hook
  const elapsed = seconds - hook.firedAt
  if (elapsed < shot.outTime) return { angle: shot.angle, length: Math.max(4, shot.length * (elapsed / shot.outTime)), carried: null }
  const back = Math.min(1, (elapsed - shot.outTime) / shot.backTime)
  return { angle: shot.angle, length: Math.max(4, shot.length * (1 - back)), carried: shot.target }
}

function Target({ target, clip }: { target: HookTarget; clip: string }) {
  const { x, y, radius, champion } = target
  if (!champion) return <Minion x={x} y={y} radius={radius} />
  return (
    <g>
      <image
        href={championIconUrl(champion.image)}
        x={x - radius}
        y={y - radius}
        width={radius * 2}
        height={radius * 2}
        clipPath={`url(#${clip})`}
      />
      <circle cx={x} cy={y} r={radius} fill="none" stroke={target.value >= 250 ? '#f5d76e' : '#c8aa6e'} strokeWidth="0.5" />
      <text x={x} y={y + radius + 2.6} textAnchor="middle" fontSize="2.4" fill="#f0e6d2" fontWeight="700">
        {target.value}g
      </text>
    </g>
  )
}

/** A red-side caster minion, drawn in SVG. */
function Minion({ x, y, radius }: { x: number; y: number; radius: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={radius} fill="#5b1f2a" stroke="#c0392b" strokeWidth="0.5" />
      <path d={`M${x - radius * 0.7} ${y - radius * 0.2} L${x} ${y - radius * 1.25} L${x + radius * 0.7} ${y - radius * 0.2} Z`} fill="#8e2c3a" />
      <circle cx={x - radius * 0.32} cy={y + radius * 0.1} r={radius * 0.16} fill="#ffd166" />
      <circle cx={x + radius * 0.32} cy={y + radius * 0.1} r={radius * 0.16} fill="#ffd166" />
      <text x={x} y={y + radius + 2.4} textAnchor="middle" fontSize="2" fill="#f0e6d2" opacity="0.7">
        20g
      </text>
    </g>
  )
}

function Bushes() {
  const bushes = [
    [12, 20, 7],
    [88, 22, 6],
    [30, 62, 8],
    [72, 64, 9],
    [52, 45, 5],
  ] as const
  return (
    <g opacity="0.45">
      {bushes.map(([x, y, size]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={size} ry={size * 0.45} fill="#2f6b3a" />
      ))}
    </g>
  )
}

function RocketGrabIcon({ cooldownLeft }: { cooldownLeft: number | null }) {
  const ready = cooldownLeft === 0
  return (
    <div className="pointer-events-none absolute top-2 right-2 size-10 overflow-hidden rounded border border-gold/70 sm:size-12">
      <img src={spellIconUrl('RocketGrab.png')} alt="Rocket Grab" className={`size-full ${ready ? '' : 'grayscale'}`} />
      {!ready && (
        <span className="absolute inset-0 flex items-center justify-center bg-abyss/60 font-mono text-sm font-bold text-gold-light">
          {cooldownLeft?.toFixed(1)}
        </span>
      )}
    </div>
  )
}

function GoldTag({ icon, label, gold, right = false }: { icon: string; label: string; gold: number; right?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <img src={icon} alt="" className="size-9 rounded-full border border-gold/60" />
      <div className="flex flex-col leading-tight">
        <span className="text-xs text-gold-light/60">{label}</span>
        <span className="font-display text-lg font-black text-gold">{gold}g</span>
      </div>
    </div>
  )
}
