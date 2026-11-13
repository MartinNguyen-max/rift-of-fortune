/**
 * How the win-chance bar looks: wilder than the honest numbers, but always on the favourite's side.
 */

/** Pulls the bar away from the middle, so a 60–40 game already looks like a real lead. */
export function barShare(chance: number): number {
  const lead = chance - 0.5
  return 0.5 + 0.5 * Math.sign(lead) * Math.abs(lead * 2) ** 0.65
}

/** How far the bar's edge wobbles, in pixels: like a coin in the air when it's close, calmer once decided. */
export function wobbleOf(chance: number): number {
  const decided = Math.abs(chance - 0.5) * 2
  return 2 + 7 * (1 - decided)
}

/** The swing of the last event, if it moved the chance by at least 5 points: who gained and how much. */
export function swingOf(history: readonly number[]): { side: 'blue' | 'red'; points: number } | null {
  const now = history[history.length - 1]
  const before = history[history.length - 2]
  if (now === undefined || before === undefined) return null
  const points = Math.round(Math.abs(now - before) * 100)
  if (points < 5) return null
  return { side: now > before ? 'blue' : 'red', points }
}
