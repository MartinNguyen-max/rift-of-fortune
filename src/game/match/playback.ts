import { GOLD } from './config'
import type { MatchEvent, Scoreboard } from './types'

/** At 1× speed, 30 game minutes take 90 seconds to watch. */
export const GAME_SECONDS_PER_SECOND = 20

export const SPEEDS = [1, 2] as const
export type Speed = (typeof SPEEDS)[number]

/** Starts the clock a couple of real seconds before the first event, not at 0:00. */
export const LEAD_IN = 2 * GAME_SECONDS_PER_SECOND

export function startTime(events: readonly MatchEvent[]): number {
  return Math.max(0, (events[0]?.time ?? 0) - LEAD_IN)
}

/** How many events have happened by `clock`. Events are in time order. */
export function eventsShown(events: readonly MatchEvent[], clock: number): number {
  const index = events.findIndex(({ time }) => time > clock)
  return index === -1 ? events.length : index
}

/** Real seconds left to watch at `speed`. */
export function secondsLeft(duration: number, clock: number, speed: Speed): number {
  return Math.max(0, duration - clock) / (GAME_SECONDS_PER_SECOND * speed)
}

/** The scoreboard at `clock`: the last event's score, with passive gold added since then. */
export function liveScore(events: readonly MatchEvent[], clock: number): Scoreboard {
  const last = events[eventsShown(events, clock) - 1]
  const since = last ? clock - last.time : clock
  const base = last?.score ?? {
    blue: { kills: 0, towers: 0, dragons: 0, barons: 0, gold: GOLD.start },
    red: { kills: 0, towers: 0, dragons: 0, barons: 0, gold: GOLD.start },
  }
  const passive = Math.round((GOLD.perMinute * Math.max(0, since)) / 60 / 100) * 100
  return {
    blue: { ...base.blue, gold: base.blue.gold + passive },
    red: { ...base.red, gold: base.red.gold + passive },
  }
}
