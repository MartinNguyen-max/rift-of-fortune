import type { Timeline } from '../match/playback'
import { blueWinChance } from '../match/winChance'
import { opponent, type ChampionRef, type LiveMatch, type MapSpot, type MatchEvent, type MatchTeams } from '../match/types'

/**
 * How many moments to show between two live events (and after the last one, not counting the
 * ending). Fewer than against bots: the mini-games are the main show.
 */
export const LIVE_REEL = { moments: 3, finalMoments: 3 } as const

/** Real seconds per moment. Fixed, so a reel that grows after each live event never shifts. */
export const LIVE_BEATS = { leadIn: 1.5, small: 1.4, big: 2.4 } as const

export interface LiveReel {
  events: MatchEvent[]
  /** Index of each reel event in the full match. */
  sources: number[]
}

const MIRRORED_SPOTS: Partial<Record<MapSpot, MapSpot>> = {
  blueJungle: 'redJungle',
  redJungle: 'blueJungle',
  blueBase: 'redBase',
  redBase: 'blueBase',
}

const mirrorRef = (ref: ChampionRef | null): ChampionRef | null => ref && { side: opponent(ref.side), role: ref.role }

function mirrorEvent(event: MatchEvent): MatchEvent {
  return {
    ...event,
    side: opponent(event.side),
    actor: mirrorRef(event.actor),
    target: mirrorRef(event.target),
    fightKills: event.fightKills && { blue: event.fightKills.red, red: event.fightKills.blue },
    kills: event.kills.map(({ killer, victim, assists }) => ({
      killer: { side: opponent(killer.side), role: killer.role },
      victim: { side: opponent(victim.side), role: victim.role },
      assists,
    })),
    spot: MIRRORED_SPOTS[event.spot] ?? event.spot,
    score: { blue: event.score.red, red: event.score.blue },
  }
}

/**
 * The match from the red player's point of view: their team becomes blue, so every screen can keep
 * showing "you" on blue side, bottom left. Baron and Dragon stay where they are on the map.
 */
export function mirrorMatch(match: LiveMatch): LiveMatch {
  return {
    ...match,
    events: match.events.map(mirrorEvent),
    stats: { blue: match.stats.red, red: match.stats.blue },
    winner: match.winner && opponent(match.winner),
  }
}

/** Blue's win chance before the match (index 0) and after each event (index i + 1). */
export function liveChances(match: LiveMatch, teams: MatchTeams): number[] {
  const last = match.events.length - 1
  return [
    blueWinChance(teams, null),
    ...match.events.map((event, index) =>
      index === last && match.winner ? (match.winner === 'blue' ? 1 : 0) : blueWinChance(teams, event.score),
    ),
  ]
}

/** The match split at each live event: [start, end) ranges of event indices. */
function chunks(match: LiveMatch): [number, number][] {
  const starts = [0, ...match.scripted]
  return starts.map((start, index) => [start, match.scripted[index] ?? match.events.length])
}

/**
 * The moments to watch: every live event, first blood, the ending, and between live events the
 * moments that swung the win chance the most. Each part only looks at its own events, so the reel
 * up to a live event stays the same when the match continues after it.
 */
export function buildLiveReel(match: LiveMatch, teams: MatchTeams): LiveReel {
  const chances = liveChances(match, teams)
  const swing = (index: number) => Math.abs((chances[index + 1] ?? 0) - (chances[index] ?? 0))
  const live = new Set(match.scripted)
  const last = match.winner ? match.events.length - 1 : -1

  const picked = chunks(match).flatMap(([start, end]) => {
    const indices = Array.from({ length: end - start }, (_, offset) => start + offset)
    const isFinal = end === match.events.length && match.winner !== null
    const must = indices.filter(
      (index) => live.has(index) || index === last || match.events[index]?.tags.includes('firstBlood'),
    )
    const rest = indices
      .filter((index) => !must.includes(index))
      .sort((a, b) => swing(b) - swing(a) || a - b)
      .slice(0, isFinal ? LIVE_REEL.finalMoments : LIVE_REEL.moments)
    return [...must, ...rest].sort((a, b) => a - b)
  })

  const events = picked.flatMap((index) => {
    const event = match.events[index]
    return event ? [{ ...event, big: event.big || live.has(index) || index === last }] : []
  })
  return { events, sources: picked }
}

/** When each reel moment starts, at a fixed pace; `total` is when the last one is done. */
export function liveTimeline(events: readonly MatchEvent[]): Timeline {
  let at = LIVE_BEATS.leadIn
  const starts = events.map(({ big }) => {
    const start = at
    at += big ? LIVE_BEATS.big : LIVE_BEATS.small
    return start
  })
  return { starts, total: at }
}
