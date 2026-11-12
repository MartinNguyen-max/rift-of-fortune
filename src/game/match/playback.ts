import { GOLD } from './config'
import type { MatchEvent, Scoreboard } from './types'

/**
 * Real seconds to watch a match: a quick stomp takes `min`, a long close game `max`, and an
 * average match (~32 game minutes) about 12–13 seconds.
 */
export const WATCH_SECONDS = { min: 10, max: 15, shortGameMinutes: 20, longGameMinutes: 42 } as const

/** Real seconds before the first event, so the screen can settle. */
export const LEAD_IN = 1

/** How much watch time each event gets, relative to each other. Big moments get time for the fight scene and the caster line. */
export const BEATS = { small: 1, big: 2 } as const

/** The game clock stands still for this share of a big moment, so the player can take it in. */
export const BIG_PAUSE = 0.6

/** Game time shown when the clock starts, this long before the first event. */
const CLOCK_LEAD_IN = 60

export interface Timeline {
  /** Real seconds after the start when each event appears. */
  starts: number[]
  /** Real seconds until the match is over. */
  total: number
}

/** How long to watch a match that lasted `gameSeconds`: longer games take a little longer. */
export function watchSeconds(gameSeconds: number): number {
  const { min, max, shortGameMinutes, longGameMinutes } = WATCH_SECONDS
  const progress = (gameSeconds / 60 - shortGameMinutes) / (longGameMinutes - shortGameMinutes)
  return min + Math.min(1, Math.max(0, progress)) * (max - min)
}

/** Spreads the events over the match's watch time, giving big moments more time than small ones. */
export function buildTimeline(events: readonly MatchEvent[]): Timeline {
  const total = watchSeconds(events.at(-1)?.time ?? 0)
  const beats = events.map(({ big }) => (big ? BEATS.big : BEATS.small))
  const totalBeats = beats.reduce((sum, beat) => sum + beat, 0)
  const unit = totalBeats > 0 ? (total - LEAD_IN) / totalBeats : 0
  let at = LEAD_IN
  const starts = beats.map((beat) => {
    const start = at
    at += beat * unit
    return start
  })
  return { starts, total }
}

/** How many events have appeared after `elapsed` real seconds. */
export function eventsShown(timeline: Timeline, elapsed: number): number {
  const index = timeline.starts.findIndex((start) => start > elapsed)
  return index === -1 ? timeline.starts.length : index
}

/** The big event whose fight scene is playing at `elapsed`, or null. */
export function activeBigEvent(events: readonly MatchEvent[], timeline: Timeline, elapsed: number): number | null {
  const index = eventsShown(timeline, elapsed) - 1
  const event = events[index]
  if (!event?.big) return null
  const end = timeline.starts[index + 1] ?? timeline.total
  return elapsed < end ? index : null
}

/** The game clock at `elapsed`, moving smoothly from one event's time to the next, and pausing on big moments. */
export function gameClock(events: readonly MatchEvent[], timeline: Timeline, elapsed: number): number {
  const first = events[0]
  if (!first) return 0
  const points = [
    { at: 0, time: Math.max(0, first.time - CLOCK_LEAD_IN) },
    ...events.flatMap(({ time, big }, index) => {
      const start = timeline.starts[index] ?? 0
      if (!big) return [{ at: start, time }]
      const end = timeline.starts[index + 1] ?? timeline.total
      return [
        { at: start, time },
        { at: start + (end - start) * BIG_PAUSE, time },
      ]
    }),
  ]
  const next = points.findIndex(({ at }) => at > elapsed)
  if (next === -1) return points[points.length - 1]?.time ?? 0
  const from = points[next - 1] ?? points[0]
  const to = points[next] ?? from
  if (!from || !to || to.at === from.at) return to?.time ?? 0
  return from.time + ((elapsed - from.at) / (to.at - from.at)) * (to.time - from.time)
}

/** The scoreboard at `clock`: the last shown event's score, with passive gold added since then. */
export function liveScore(events: readonly MatchEvent[], shown: number, clock: number): Scoreboard {
  const last = events[shown - 1]
  const since = last ? clock - last.time : clock
  const start = { kills: 0, towers: 0, dragons: 0, barons: 0, inhibitors: 0, gold: GOLD.start }
  const base = last?.score ?? { blue: start, red: start }
  const passive = Math.round((GOLD.perMinute * Math.max(0, since)) / 60 / 100) * 100
  return {
    blue: { ...base.blue, gold: base.blue.gold + passive },
    red: { ...base.red, gold: base.red.gold + passive },
  }
}
