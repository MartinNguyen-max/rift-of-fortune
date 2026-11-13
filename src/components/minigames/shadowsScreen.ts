import { figuresAfter, SHADOW_TIMING, shuffleMs, type ShadowRound } from '../../game/minigames/shadows'

/** Where one figure is drawn. */
export interface FigurePlace {
  /** The spot as a number: 0 left, 1 middle, 2 right, in between while moving. */
  x: number
  /** -1 arcing up (behind), 1 arcing down (in front), 0 standing in the row. */
  lift: number
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** How far a feint goes towards the other spot before turning back. */
const FEINT_REACH = 0.42

/**
 * Where each figure is, `ms` into the shuffle, by figure (figure `n` starts on spot `n`). Two
 * figures trade places at a time, one arcing over the top and one underneath, so they never
 * overlap and the eye can follow them.
 */
export function figurePlaces(round: ShadowRound, ms: number): FigurePlace[] {
  const done = Math.min(round.swaps.length, Math.floor(Math.max(0, ms) / round.swapMs))
  const figures = figuresAfter(round, done)
  const places: FigurePlace[] = [0, 1, 2].map(() => ({ x: 0, lift: 0 }))
  figures.forEach((figure, spot) => (places[figure] = { x: spot, lift: 0 }))

  const swap = round.swaps[done]
  if (!swap) return places
  const t = (ms - done * round.swapMs) / round.swapMs
  const over = figures[swap.from] ?? swap.from
  const under = figures[swap.to] ?? swap.to
  const arc = Math.sin(Math.PI * t)
  const travel = swap.feint ? FEINT_REACH * arc : easeInOut(t)
  const lift = swap.feint ? 0.55 * arc : arc
  places[over] = { x: swap.from + (swap.to - swap.from) * travel, lift: -lift }
  places[under] = { x: swap.to + (swap.from - swap.to) * travel, lift }
  return places
}

export type ShadowPhase = 'show' | 'blend' | 'shuffle' | 'pick'

/** What a round shows `ms` after it started: Zed pointed out, turning to shadow, the shuffle, then the pick. */
export function shadowPhase(round: ShadowRound, step: number, ms: number): { phase: ShadowPhase; shuffleAt: number } {
  const show = step === 0 ? SHADOW_TIMING.firstShowMs : SHADOW_TIMING.showMs
  const shuffleStart = show + SHADOW_TIMING.blendMs
  const shuffleAt = Math.max(0, ms - shuffleStart)
  if (ms < show) return { phase: 'show', shuffleAt: 0 }
  if (ms < shuffleStart) return { phase: 'blend', shuffleAt: 0 }
  if (shuffleAt < shuffleMs(round)) return { phase: 'shuffle', shuffleAt }
  return { phase: 'pick', shuffleAt: shuffleMs(round) }
}
