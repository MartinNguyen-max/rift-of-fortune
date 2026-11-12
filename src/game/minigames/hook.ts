import type { Champion, ChampionClass } from '../../data/types'
import { sample, seededRandom, type RandomFn } from '../random'
import { owedScores, settleScores, type MiniGameRules, type Variant } from './versus'

/**
 * Rocket Grab Gold Rush, played like Gold Miner: the hook swings from Blitzcrank at the top of
 * the field, fires in a straight line and pulls back whatever it hits. Heavy targets come back slowly.
 * The field is FIELD.width × FIELD.height units, y pointing down.
 */
export const FIELD = { width: 100, height: 70 } as const

/** Seconds for the whole game: shorter in Multiplayer. */
export const HOOK_SECONDS: Record<Variant, number> = { solo: 25, live: 15 }
export const HOOK_ORIGIN = { x: 50, y: 7 } as const

export const HOOK = {
  /** Rocket Grab cooldown after the hook is back, in seconds. */
  cooldown: 0.9,
  /** The swing goes from -maxAngle to +maxAngle degrees (0 is straight down). */
  maxAngle: 72,
  /** Seconds for one full swing, there and back. */
  swingPeriod: 2.8,
  /** Units per second while the hook flies out. */
  speedOut: 95,
  /** Units per second pulling back with nothing on it. */
  speedEmpty: 150,
} as const

export type HookTargetKind = 'champion' | 'minion'

export interface HookTarget {
  id: string
  kind: HookTargetKind
  /** The grabbed champion, for champions. */
  champion: Champion | null
  x: number
  y: number
  radius: number
  /** Gold for grabbing it. */
  value: number
  /** Units per second while pulling it back: lower is heavier. */
  pullSpeed: number
}

interface TargetProfile {
  value: number
  radius: number
  pullSpeed: number
}

/** Carries are small, light and worth a lot; tanks are easy to hit but slow to pull. */
const CLASS_PROFILES: Record<ChampionClass, TargetProfile> = {
  Marksman: { value: 300, radius: 4, pullSpeed: 85 },
  Mage: { value: 250, radius: 4.2, pullSpeed: 78 },
  Assassin: { value: 250, radius: 4, pullSpeed: 80 },
  Support: { value: 200, radius: 4.5, pullSpeed: 65 },
  Fighter: { value: 175, radius: 5, pullSpeed: 50 },
  Tank: { value: 150, radius: 6, pullSpeed: 32 },
}
const MINION: TargetProfile = { value: 20, radius: 3.4, pullSpeed: 40 }
export const MINION_COUNT = 6

export const championProfile = (champion: Champion): TargetProfile =>
  CLASS_PROFILES[champion.classes[0] ?? 'Fighter']

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

/** Puts a target somewhere in the area without touching the others. Gives up after many tries. */
function place(
  placed: HookTarget[],
  radius: number,
  area: { top: number; bottom: number },
  random: RandomFn,
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < 300; attempt++) {
    const spot = {
      x: 6 + radius + random() * (FIELD.width - 12 - radius * 2),
      y: area.top + random() * (area.bottom - area.top),
    }
    const free = placed.every((other) => distance(spot, other) > other.radius + radius + 2.5)
    if (free && distance(spot, HOOK_ORIGIN) > 18) return spot
  }
  return null
}

/** The field for a game: 3 or 5 enemy champions deep down, with minions in front of them. */
export function hookField(seed: number, pool: readonly Champion[]): HookTarget[] {
  const random = seededRandom(seed)
  const championCount = random() < 0.5 ? 3 : 5
  const targets: HookTarget[] = []

  for (const champion of sample(pool, championCount, random)) {
    const profile = championProfile(champion)
    const spot = place(targets, profile.radius, { top: 34, bottom: FIELD.height - 4 - profile.radius }, random)
    if (spot) targets.push({ id: champion.id, kind: 'champion', champion, ...spot, ...profile })
  }
  for (let index = 0; index < MINION_COUNT; index++) {
    const spot = place(targets, MINION.radius, { top: 22, bottom: 52 }, random)
    if (spot) targets.push({ id: `minion-${index}`, kind: 'minion', champion: null, ...spot, ...MINION })
  }
  return targets
}

/** The hook's angle in degrees, `seconds` into the swing. */
export const swingAngle = (seconds: number): number =>
  HOOK.maxAngle * Math.sin((2 * Math.PI * seconds) / HOOK.swingPeriod)

/** Unit vector for an angle in degrees, 0 pointing straight down. */
export function direction(angle: number): { dx: number; dy: number } {
  const radians = (angle * Math.PI) / 180
  return { dx: Math.sin(radians), dy: Math.cos(radians) }
}

/** How far the hook flies at this angle before leaving the field. */
export function maxReach(angle: number): number {
  const { dx, dy } = direction(angle)
  const toSide = dx === 0 ? Infinity : dx > 0 ? (FIELD.width - HOOK_ORIGIN.x) / dx : -HOOK_ORIGIN.x / dx
  const toBottom = (FIELD.height - HOOK_ORIGIN.y) / dy
  return Math.min(toSide, toBottom)
}

/** The point the hook reaches after flying `length` units at `angle`. */
export function hookTip(angle: number, length: number): { x: number; y: number } {
  const { dx, dy } = direction(angle)
  return { x: HOOK_ORIGIN.x + dx * length, y: HOOK_ORIGIN.y + dy * length }
}

export interface HookShot {
  angle: number
  /** What the hook grabs, or null for a miss. */
  target: HookTarget | null
  /** How far the hook flies before it hits or leaves the field. */
  length: number
  /** Seconds flying out. */
  outTime: number
  /** Seconds pulling back. */
  backTime: number
}

/** Fires the hook at `angle`: it grabs the first target in its path (a ray hitting a circle). */
export function fireHook(targets: readonly HookTarget[], angle: number): HookShot {
  const { dx, dy } = direction(angle)
  let target: HookTarget | null = null
  let length = maxReach(angle)

  for (const candidate of targets) {
    const toX = candidate.x - HOOK_ORIGIN.x
    const toY = candidate.y - HOOK_ORIGIN.y
    const along = toX * dx + toY * dy
    if (along <= 0) continue
    const missBy = toX * toX + toY * toY - along * along
    const radiusSquared = candidate.radius * candidate.radius
    if (missBy > radiusSquared) continue
    const hitAt = along - Math.sqrt(radiusSquared - missBy)
    if (hitAt < length) {
      length = hitAt
      target = candidate
    }
  }
  const pullSpeed = target?.pullSpeed ?? HOOK.speedEmpty
  return { angle, target, length, outTime: length / HOOK.speedOut, backTime: length / pullSpeed }
}

/** The angle that points the hook at a spot. */
export const angleTo = (spot: { x: number; y: number }): number =>
  (Math.atan2(spot.x - HOOK_ORIGIN.x, spot.y - HOOK_ORIGIN.y) * 180) / Math.PI

/** Total gold of everything grabbed. */
export const hookGold = (grabbed: readonly HookTarget[]): number =>
  grabbed.reduce((total, target) => total + target.value, 0)

/** One grab by the bot: the gold lands at `at` seconds. */
export interface BotGrab {
  at: number
  target: HookTarget
}

/** How good the bot is: the share of shots it lands where it aims. */
export const BOT_HOOK_ACCURACY = 0.6

/**
 * The bot plays the same field: it waits for its swing, aims at the champion worth the most gold
 * per second of pulling, and lands the shot BOT_HOOK_ACCURACY of the time. A miss can still hit a
 * minion. Grabs that come back after the timer runs out don't count.
 */
export function botGrabs(field: readonly HookTarget[], seed: number, duration = HOOK_SECONDS.solo): BotGrab[] {
  const random = seededRandom(seed ^ 0x9e3779b9)
  const remaining = [...field]
  const grabs: BotGrab[] = []
  let time = 0

  while (time < duration) {
    const champions = remaining.filter((target) => target.kind === 'champion')
    const aim = champions.toSorted((a, b) => b.value * b.pullSpeed - a.value * a.pullSpeed)[0]
    if (!aim) break
    time += 0.5 + random() * 1.1
    const offset = random() < BOT_HOOK_ACCURACY ? 0 : (random() < 0.5 ? -1 : 1) * (5 + random() * 12)
    const shot = fireHook(remaining, angleTo(aim) + offset)
    time += shot.outTime + shot.backTime
    if (time > duration) break
    if (shot.target) {
      grabs.push({ at: time, target: shot.target })
      remaining.splice(remaining.indexOf(shot.target), 1)
    }
    time += HOOK.cooldown
  }
  return grabs
}

/** The bot's gold at `seconds` into the game. */
export const botGoldAt = (grabs: readonly BotGrab[], seconds: number): number =>
  hookGold(grabs.filter(({ at }) => at <= seconds).map(({ target }) => target))

/** The rules, with the champion pool the field is built from. */
export const hookRules = (pool: readonly Champion[]): MiniGameRules => ({
  chances: 1,
  liveSeconds: () => HOOK_SECONDS.live + 6,
  owed: owedScores,
  settle: (moves) => settleScores(moves),
  fallback: () => 0,
  botMove: (step, _moves, { seed, variant }) =>
    step === 0
      ? hookGold(botGrabs(hookField(seed, pool), seed, HOOK_SECONDS[variant]).map(({ target }) => target))
      : undefined,
  formatScore: (gold) => `${gold} gold`,
  best: { of: (moves) => moves[0][0] ?? null, lowerIsBetter: false, format: (gold) => `${gold} gold` },
})
