import type { MatchEvent, MatchResult, MatchTeams } from './types'
import { winChanceTimeline } from './winChance'

/** How many moments the player watches, and how many of them are game-changing. */
export const REEL = { moments: 10, keyMoments: 2 } as const

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
 * the most, first blood, and then the next biggest swings until there are `moments` events.
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

  const keyMoments = bySwing.slice(0, REEL.keyMoments)
  const firstBlood = match.events.findIndex(({ tags }) => tags.includes('firstBlood'))
  const picked = new Set([last, ...keyMoments])
  if (firstBlood >= 0) picked.add(firstBlood)
  for (const index of bySwing) {
    if (picked.size >= REEL.moments) break
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
