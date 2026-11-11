/** A function returning a number in [0, 1), like Math.random. Injected so tests are deterministic. */
export type RandomFn = () => number

/** Small seeded random generator (mulberry32), so simulations and the Daily are reproducible. */
export function seededRandom(seed: number): RandomFn {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Turns any string (e.g. a date) into a 32-bit seed for `seededRandom`. */
export function seedFromString(text: string): number {
  let hash = 2166136261
  for (const char of text) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function pickRandom<T>(list: readonly T[], random: RandomFn = Math.random): T {
  const value = list[Math.floor(random() * list.length)]
  if (value === undefined) throw new Error('Cannot pick from an empty list')
  return value
}

/** Picks `count` distinct entries using a partial Fisher-Yates shuffle on a copy. */
export function sample<T>(list: readonly T[], count: number, random: RandomFn = Math.random): T[] {
  const copy = [...list]
  const picked = Math.min(count, copy.length)
  for (let i = 0; i < picked; i++) {
    const j = i + Math.floor(random() * (copy.length - i))
    const current = copy[i] as T
    copy[i] = copy[j] as T
    copy[j] = current
  }
  return copy.slice(0, picked)
}
