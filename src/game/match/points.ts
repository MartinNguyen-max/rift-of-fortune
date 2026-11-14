import type { Side } from './types'

/**
 * Match points: the simple score players see after a match. Each team starts with its team rating
 * and the winner of each live event gets an even share of LIVE_EVENT_POINTS (3 events: +10 each).
 * A team that ends SURE_WIN_LEAD or more points ahead always wins the match. Below that, the
 * simulation decides and the underdog can get lucky.
 */
export const LIVE_EVENT_POINTS = 30
export const SURE_WIN_LEAD = 15

export type MatchPoints = Record<Side, number>

/** What winning one live event is worth when the match has `eventCount` of them. */
export const pointsPerEvent = (eventCount: number): number => (eventCount > 0 ? Math.round(LIVE_EVENT_POINTS / eventCount) : 0)

/** The points at the start (index 0) and after each live event played so far (index i + 1). */
export function pointsTimeline(ratings: MatchPoints, winners: readonly Side[], eventCount: number): MatchPoints[] {
  const prize = pointsPerEvent(eventCount)
  const start: MatchPoints = { blue: Math.round(ratings.blue), red: Math.round(ratings.red) }
  return winners.reduce<MatchPoints[]>((timeline, winner) => {
    const last = timeline[timeline.length - 1] ?? start
    return [...timeline, { ...last, [winner]: last[winner] + prize }]
  }, [start])
}

/** The side this far ahead that it always wins, or null when the game is close enough for luck. */
export function sureWinner(points: MatchPoints): Side | null {
  if (points.blue - points.red >= SURE_WIN_LEAD) return 'blue'
  if (points.red - points.blue >= SURE_WIN_LEAD) return 'red'
  return null
}

/**
 * Why the winner won, for the short result: a sure win (far ahead), the team ahead holding on,
 * an upset (the team behind got lucky, only possible when close), or dead even.
 */
export type PointsVerdict = 'sure' | 'held' | 'upset' | 'even'

export function pointsVerdict(points: MatchPoints, winner: Side): PointsVerdict {
  const loser: Side = winner === 'blue' ? 'red' : 'blue'
  if (sureWinner(points) === winner) return 'sure'
  if (points[winner] === points[loser]) return 'even'
  return points[winner] > points[loser] ? 'held' : 'upset'
}
