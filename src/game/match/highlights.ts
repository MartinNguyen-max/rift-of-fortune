import { WATCH_SECONDS } from './playback'
import type { MatchEvent, MatchResult, MatchTeams } from './types'
import { winChanceTimeline } from './winChance'

/**
 * How many moments the player watches: a stomp shows `minMoments`, a long game more, and every
 * time the lead changed hands adds one (up to `leadChangeBonus`), so close games feel busier.
 * `keyMoments` are the game-changing ones that get a fight scene.
 */
export const REEL = { minMoments: 8, lengthBonus: 4, leadChangeBonus: 2, keyMoments: 2 } as const

/** How many times the favourite switched sides during the match. */
export function leadChanges(chances: readonly number[]): number {
  let changes = 0
  for (let index = 1; index < chances.length - 1; index++) {
    const before = chances[index - 1] ?? 0.5
    const after = chances[index] ?? 0.5
    if (before !== 0.5 && after !== 0.5 && before > 0.5 !== after > 0.5) changes += 1
  }
  return changes
}

/** How many moments to show for a match. */
export function reelLength(match: MatchResult, chances: readonly number[]): number {
  const { shortGameMinutes, longGameMinutes } = WATCH_SECONDS
  const length = Math.min(1, Math.max(0, (match.duration / 60 - shortGameMinutes) / (longGameMinutes - shortGameMinutes)))
  return REEL.minMoments + Math.round(length * REEL.lengthBonus) + Math.min(REEL.leadChangeBonus, leadChanges(chances))
}

/**
 * The match as the player watches it: a handful of moments picked from the full simulation.
 * `events` are copies where `big` marks the key moments and the ending; `sources[i]` is the
 * index of `events[i]` in the full match, so scores and K/D/A can include everything in between.
 */
export interface HighlightReel {
  events: MatchEvent[]
  sources: number[]
}

/**
 * Picks the moments worth watching: the ending, the `keyMoments` events that swung the win chance
 * the most, first blood, and then the next biggest swings until the reel is full (`reelLength`).
 * The match result itself never changes; only what is shown.
 */
export function buildHighlightReel(match: MatchResult, teams: MatchTeams): HighlightReel {
  const last = match.events.length - 1
  const chances = winChanceTimeline(match, teams)
  const swing = (index: number) => Math.abs((chances[index + 1] ?? 0) - (chances[index] ?? 0))
  const bySwing = match.events
    .map((_, index) => index)
    .filter((index) => index !== last)
    .sort((a, b) => swing(b) - swing(a) || a - b)

  const moments = reelLength(match, chances)
  const keyMoments = bySwing.slice(0, REEL.keyMoments)
  const firstBlood = match.events.findIndex(({ tags }) => tags.includes('firstBlood'))
  const picked = new Set([last, ...keyMoments])
  if (firstBlood >= 0) picked.add(firstBlood)
  for (const index of bySwing) {
    if (picked.size >= moments) break
    picked.add(index)
  }

  const sources = [...picked].filter((index) => index >= 0).sort((a, b) => a - b)
  const big = new Set([last, ...keyMoments])
  const events = sources.flatMap((index) => {
    const event = match.events[index]
    return event ? [{ ...event, big: big.has(index) }] : []
  })
  return { events, sources }
}
