import type { Lane, Side } from '../match/types'
import { pickRandom, type RandomFn } from '../random'
import { LANES } from '../match/types'
import { duelWinner, gankWinner, LIVE_EVENT_COUNT, LIVE_EVENTS, liveScript } from './liveEvents'
import type { EventResult, PlayerId, PlayerInfo, RoomMessage } from './protocol'
import type { EncodedTeam } from './teamCode'
import { ULT } from './ult'

/** The "Get ready" screen before each mini-game, and the 3-2-1 after it, in seconds. */
const INTRO_SECONDS = 5
const COUNTDOWN_SECONDS = 4

/** Seconds for each step. Players get a little extra time (`grace`) for slow connections. */
export const TIMINGS = {
  draft: 90,
  draftGrace: 5,
  versus: 15,
  /** The "Get ready" screen before each mini-game, with one line on what to do. */
  intro: INTRO_SECONDS,
  /** Hiding and guessing in the gank. */
  gankHide: 12,
  gankGuess: 12,
  /** The longest a smite duel or the ult bar can take, plus the intro and the 3-2-1. */
  duel: INTRO_SECONDS + COUNTDOWN_SECONDS + Math.max(16, ULT.seconds),
  /** How long the host waits for a player who is still connected but hasn't answered. */
  eventGrace: 15,
} as const

export interface LiveEventState {
  /** When the first player reached this event (local time, ms). Starts the host's timeouts. */
  openedAt: number | null
  arrived: PlayerId[]
  scores: Partial<Record<PlayerId, number>>
  bush: Lane | null
  hiddenAt: number | null
  /** undefined: not guessed yet; null: ran out of time. */
  guess: Lane | null | undefined
  result: EventResult | null
}

/** Everything both players need to agree on for one game, built from the messages. */
export interface RoundState {
  id: string
  /** Blue (the host) first. */
  players: PlayerInfo[]
  draftSeconds: number
  startedAt: number
  teams: Partial<Record<PlayerId, EncodedTeam>>
  /** Set once both teams are locked in. */
  match: { seed: number; teams: EncodedTeam[]; startedAt: number } | null
  events: LiveEventState[]
  surrendered: PlayerId | null
}

const emptyEvent = (): LiveEventState => ({
  openedAt: null,
  arrived: [],
  scores: {},
  bush: null,
  hiddenAt: null,
  guess: undefined,
  result: null,
})

export function sideOf(round: Pick<RoundState, 'players'>, player: PlayerId): Side {
  return round.players[0]?.id === player ? 'blue' : 'red'
}

export function playerOn(round: Pick<RoundState, 'players'>, side: Side): PlayerInfo | undefined {
  return round.players[side === 'blue' ? 0 : 1]
}

const updateEvent = (round: RoundState, index: number, update: (event: LiveEventState) => LiveEventState): RoundState => {
  const event = round.events[index]
  if (!event || event.result) return round
  return { ...round, events: round.events.map((current, at) => (at === index ? update(current) : current)) }
}

const isPlayer = (round: RoundState, player: PlayerId) => round.players.some(({ id }) => id === player)

/**
 * Applies one message. Both players get the same messages, so they end up with the same round.
 * The first answer counts: repeats and late answers are ignored.
 */
export function roundReducer(round: RoundState | null, message: RoomMessage, now: number): RoundState | null {
  if (message.type === 'startDraft') {
    if (round?.id === message.round) return round
    return {
      id: message.round,
      players: message.players,
      draftSeconds: message.seconds,
      startedAt: now,
      teams: {},
      match: null,
      events: Array.from({ length: LIVE_EVENT_COUNT }, emptyEvent),
      surrendered: null,
    }
  }
  if (!round || message.type === 'emote' || message.round !== round.id) return round

  switch (message.type) {
    case 'team':
      if (round.match || !isPlayer(round, message.player) || round.teams[message.player]) return round
      return { ...round, teams: { ...round.teams, [message.player]: message.team } }
    case 'startMatch':
      return round.match ? round : { ...round, match: { seed: message.seed, teams: message.teams, startedAt: now } }
    case 'arrived':
      return updateEvent(round, message.event, (event) => ({
        ...event,
        openedAt: event.openedAt ?? now,
        arrived: event.arrived.includes(message.player) ? event.arrived : [...event.arrived, message.player],
      }))
    case 'score':
      return updateEvent(round, message.event, (event) =>
        event.scores[message.player] === undefined
          ? { ...event, scores: { ...event.scores, [message.player]: message.score } }
          : event,
      )
    case 'hide':
      return updateEvent(round, message.event, (event) =>
        event.bush === null ? { ...event, bush: message.bush, hiddenAt: now } : event,
      )
    case 'guess':
      return updateEvent(round, message.event, (event) =>
        event.bush !== null && event.guess === undefined ? { ...event, guess: message.bush } : event,
      )
    case 'eventResult':
      return updateEvent(round, message.event, (event) => ({ ...event, result: message.result }))
    case 'surrender':
      return round.surrendered || !isPlayer(round, message.player) ? round : { ...round, surrendered: message.player }
  }
}

/** The winners of the live events decided so far, in order, stopping at the first open one. */
export function decidedWinners(round: RoundState): Side[] {
  const winners: Side[] = []
  for (const event of round.events) {
    if (!event.result) break
    winners.push(event.result.winner)
  }
  return winners
}

export interface HostContext {
  now: number
  /** Ids of the players connected right now. */
  online: readonly PlayerId[]
  random: RandomFn
  /** A random full team, for a player who never sent theirs. */
  randomTeam: () => EncodedTeam
}

const seconds = (value: number) => value * 1000

/**
 * What the host sends next, if anything: start the match once both teams are in (or the draft
 * time is up), and settle each live event once both players answered (or ran out of time).
 * A player who is gone never holds the game up; they simply score 0.
 */
export function hostMessages(round: RoundState, context: HostContext): RoomMessage[] {
  if (round.surrendered) return []
  if (!round.match) return draftMessages(round, context)
  const index = round.events.findIndex((event) => !event.result)
  const event = round.events[index]
  if (!event) return []
  const kind = LIVE_EVENTS[index]?.kind
  return kind === 'gank' ? gankMessages(round, index, event, context) : duelMessages(round, index, event, context)
}

function draftMessages(round: RoundState, { now, online, random, randomTeam }: HostContext): RoomMessage[] {
  const timeUp = now >= round.startedAt + seconds(round.draftSeconds + TIMINGS.draftGrace)
  const teams = round.players.map(({ id }) =>
    round.teams[id] ?? (timeUp || !online.includes(id) ? randomTeam() : undefined),
  )
  if (!teams.every((team) => team !== undefined)) return []
  return [{ type: 'startMatch', round: round.id, seed: Math.floor(random() * 2 ** 32), teams }]
}

/** A player is waited for while connected and still within the time limit. */
function waitingFor(player: PlayerId, since: number | null, limit: number, { now, online }: HostContext): boolean {
  if (!online.includes(player)) return false
  return since === null || now < since + seconds(limit + TIMINGS.eventGrace)
}

function duelMessages(round: RoundState, index: number, event: LiveEventState, context: HostContext): RoomMessage[] {
  if (event.openedAt === null || !round.match) return []
  const [blue, red] = round.players
  if (!blue || !red) return []
  const missing = [blue, red].filter(({ id }) => event.scores[id] === undefined)
  if (missing.some(({ id }) => waitingFor(id, event.openedAt, TIMINGS.duel, context))) return []
  const scores = { blue: event.scores[blue.id] ?? 0, red: event.scores[red.id] ?? 0 }
  const winner = duelWinner(scores, round.match.seed, index)
  return [{ type: 'eventResult', round: round.id, event: index, result: { winner, scores, bush: null, guess: null } }]
}

function gankMessages(round: RoundState, index: number, event: LiveEventState, context: HostContext): RoomMessage[] {
  if (event.openedAt === null || !round.match) return []
  const { ganker } = liveScript(round.match.seed)[index] ?? { ganker: 'blue' as Side }
  const gankerId = playerOn(round, ganker)?.id ?? ''
  const defenderId = playerOn(round, ganker === 'blue' ? 'red' : 'blue')?.id ?? ''

  if (event.bush === null) {
    if (waitingFor(gankerId, event.openedAt, TIMINGS.intro + TIMINGS.gankHide, context)) return []
    return [{ type: 'hide', round: round.id, event: index, bush: pickRandom(LANES, context.random) }]
  }
  if (event.guess === undefined && waitingFor(defenderId, event.hiddenAt, TIMINGS.intro + TIMINGS.gankGuess, context)) return []
  const guess = event.guess ?? null
  const result: EventResult = { winner: gankWinner(ganker, event.bush, guess), scores: null, bush: event.bush, guess }
  return [{ type: 'eventResult', round: round.id, event: index, result }]
}
