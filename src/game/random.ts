/** A function returning a number in [0, 1), like Math.random. Injected so tests are deterministic. */
export type RandomFn = () => number

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
