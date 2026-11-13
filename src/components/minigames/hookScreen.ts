import { useCallback, useEffect, useRef, useState } from 'react'
import { fireHook, HOOK, hookGold, swingAngle, type BotGrab, type HookShot, type HookTarget } from '../../game/minigames/hook'
import { usePressKey, useStopwatch } from './useStopwatch'

/** A grab and the moment its gold lands, yours or the bot's. */
export type Grab = BotGrab

/** One Rocket Grab, with the swing time it was fired at so the swing resumes from there. */
interface FiredShot {
  firedAt: number
  swingTime: number
  shot: HookShot
}

/** The field and the hook at one moment of your run. */
export interface HookFrame {
  /** Targets still lying on the field. */
  remaining: HookTarget[]
  /** Gold banked: only what has been pulled all the way back. */
  gold: number
  angle: number
  /** How far the hook reaches out from Blitzcrank. */
  length: number
  /** The target on its way back, drawn on the hook. */
  carried: HookTarget | null
  /** Seconds until Rocket Grab is ready again; null while the hook is out. */
  cooldownLeft: number | null
  /** Where the swing is: the next shot fires from here. */
  swingTime: number
}

/** How your run ended: at the buzzer, or early with an ace (every champion grabbed). */
export interface HookRunEnd {
  gold: number
  ace: boolean
}

/** The hook pokes out of Blitzcrank this far while swinging. */
const RESTING_LENGTH = 4

const hitsAt = ({ firedAt, shot }: FiredShot) => firedAt + shot.outTime
const landsAt = (fired: FiredShot) => hitsAt(fired) + fired.shot.backTime

const grabsOf = (shots: readonly FiredShot[]): Grab[] =>
  shots.flatMap((fired) => (fired.shot.target ? [{ at: landsAt(fired), target: fired.shot.target }] : []))

/** Grabs whose gold landed less than `seconds` ago, for the "+300g" popups. */
export const recentGrabs = (grabs: readonly Grab[], now: number, seconds: number): Grab[] =>
  grabs.filter(({ at }) => at <= now && now - at < seconds)

/** Works out the whole field from the shots fired so far, `now` seconds into the run. */
function hookFrame(field: readonly HookTarget[], shots: readonly FiredShot[], now: number): HookFrame {
  const taken = new Set(shots.filter((fired) => hitsAt(fired) <= now).map(({ shot }) => shot.target))
  const remaining = field.filter((target) => !taken.has(target))
  const gold = hookGold(grabsOf(shots).flatMap(({ at, target }) => (at <= now ? [target] : [])))
  const last = shots.at(-1)

  if (!last || landsAt(last) <= now) {
    const swingingSince = last ? landsAt(last) : 0
    const swingTime = (last?.swingTime ?? 0) + now - swingingSince
    const cooldownLeft = last ? Math.max(0, swingingSince + HOOK.cooldown - now) : 0
    return { remaining, gold, angle: swingAngle(swingTime), length: RESTING_LENGTH, carried: null, cooldownLeft, swingTime }
  }

  const { shot } = last
  const elapsed = now - last.firedAt
  const pulling = elapsed >= shot.outTime
  const reach = pulling ? 1 - Math.min(1, (elapsed - shot.outTime) / shot.backTime) : elapsed / shot.outTime
  return {
    remaining,
    gold,
    angle: shot.angle,
    length: Math.max(RESTING_LENGTH, shot.length * reach),
    carried: pulling ? shot.target : null,
    cooldownLeft: null,
    swingTime: last.swingTime,
  }
}

/** Fires Rocket Grab `at` seconds into the run if it is ready; otherwise nothing changes. */
function withShot(field: readonly HookTarget[], shots: readonly FiredShot[], at: number): readonly FiredShot[] {
  const frame = hookFrame(field, shots, at)
  if (frame.cooldownLeft !== 0) return shots
  return [...shots, { firedAt: at, swingTime: frame.swingTime, shot: fireHook(frame.remaining, swingAngle(frame.swingTime)) }]
}

/** When the run ends: at the buzzer, or as soon as the last champion is pulled back in time. */
function runEnd(field: readonly HookTarget[], shots: readonly FiredShot[], duration: number): { at: number; ace: boolean } {
  const championCount = field.filter(({ kind }) => kind === 'champion').length
  const championGrabs = grabsOf(shots).filter(({ target }) => target.kind === 'champion')
  const lastLanding = Math.max(...championGrabs.map(({ at }) => at))
  const ace = championCount > 0 && championGrabs.length === championCount && lastLanding <= duration
  return ace ? { at: lastLanding, ace } : { at: duration, ace }
}

interface HookRunOptions {
  field: readonly HookTarget[]
  /** Seconds on the clock. */
  duration: number
  /** False before GO, and once your move is in (sent, or filled in by the host). */
  active: boolean
  /** Called once when the run ends by itself, with the gold that counts. */
  onEnd: (end: HookRunEnd) => void
}

/**
 * Your run on the field: the clock, the swinging hook and every shot. Fires on Space or Enter;
 * call `fire` for taps. Anything still on the hook when the clock runs out doesn't count.
 */
export function useHookRun({ field, duration, active, onEnd }: HookRunOptions) {
  const [shots, setShots] = useState<readonly FiredShot[]>([])
  const [ended, setEnded] = useState<HookRunEnd | null>(null)
  /** Counts taps while Rocket Grab wasn't ready, to shake its icon. */
  const [denied, setDenied] = useState(0)
  const running = active && ended === null
  const { seconds, read } = useStopwatch(running)
  const { at: endAt, ace } = runEnd(field, shots, duration)
  const now = ended ? endAt : Math.min(seconds, endAt)

  const latestOnEnd = useRef(onEnd)
  useEffect(() => {
    latestOnEnd.current = onEnd
  }, [onEnd])

  useEffect(() => {
    if (!running) return
    const id = window.setTimeout(
      () => {
        const result = { gold: hookFrame(field, shots, endAt).gold, ace }
        setEnded(result)
        latestOnEnd.current(result)
      },
      Math.max(0, (endAt - read()) * 1000),
    )
    return () => window.clearTimeout(id)
  }, [running, field, shots, endAt, ace, read])

  const fire = useCallback(() => {
    if (!running) return
    const at = read()
    if (at >= endAt || hookFrame(field, shots, at).cooldownLeft !== 0) {
      setDenied((count) => count + 1)
      return
    }
    setShots((current) => withShot(field, current, at))
  }, [running, read, endAt, field, shots])
  usePressKey(fire, running)

  return {
    /** Seconds into the run, stopped where it ended. */
    now,
    frame: hookFrame(field, shots, now),
    /** Your grabs with the moment each one's gold lands. */
    grabs: grabsOf(shots),
    shotsFired: shots.length,
    denied,
    ended,
    fire,
  }
}
