import type { Side } from '../match/types'
import { MINI_GAME_RULES } from '../minigames/registry'
import { withMove, type BothMoves, type Moves } from '../minigames/versus'
import type { RandomFn } from '../random'
import { eventSetup, eventWinner, liveEvents, type LiveEvent } from './liveEvents'
import type { EventResult, PlayerId, PlayerInfo, RoomMessage, RoundMessage } from './protocol'
import type { LobbySettings } from './settings'
import type { EncodedTeam } from './teamCode'

/** Seconds for each step. Players get a little extra time (`grace`) for slow connections. */
export const TIMINGS = {
  draftGrace: 5,
  versus: 10,
  /** The intro before each live event: it ends when both press Ready, or after this. */
  intro: 10,
  /** The face-off (both champions, VS) before each mini-game. */
  opening: 2.5,
  /** How long the host waits past a mini-game's time limit before filling in missing moves. */
  eventGrace: 6,
  /** A player gone this long gets poor moves filled in, so the other never waits for nothing. */
  offline: 3,
  /** A player gone this long has surrendered. */
  gone: 30,
} as const

export interface LiveEventState {
  /** When the first player reached this event (local time, ms). */
  openedAt: number | null
  arrived: PlayerId[]
  /** Players who pressed Ready on the intro. */
  ready: PlayerId[]
  /** When both had pressed Ready (local time, ms). */
  readyAt: number | null
  /** The mini-game moves by player: 0 the host (blue), 1 the guest (red). */
  moves: BothMoves
  result: EventResult | null
}

/** Everything both players need to agree on for one game, built from the messages. */
export interface RoundState {
  id: string
  /** Blue (the host) first. */
  players: PlayerInfo[]
  settings: LobbySettings
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
  ready: [],
  readyAt: null,
  moves: [[], []],
  result: null,
})

export function sideOf(round: Pick<RoundState, 'players'>, player: PlayerId): Side {
  return round.players[0]?.id === player ? 'blue' : 'red'
}

export function playerOn(round: Pick<RoundState, 'players'>, side: Side): PlayerInfo | undefined {
  return round.players[side === 'blue' ? 0 : 1]
}

/** A player's index in the mini-games: 0 for the host, 1 for the guest, or null for a stranger. */
export function playerIndex(round: Pick<RoundState, 'players'>, player: PlayerId): 0 | 1 | null {
  const index = round.players.findIndex(({ id }) => id === player)
  return index === 0 || index === 1 ? index : null
}

/** The live events of the round's match, or none before the match starts. */
export function roundEvents(round: Pick<RoundState, 'match' | 'settings'>): LiveEvent[] {
  return round.match ? liveEvents(round.match.seed, round.settings.games) : []
}

const updateEvent = (round: RoundState, index: number, update: (event: LiveEventState) => LiveEventState): RoundState => {
  const event = round.events[index]
  if (!event || event.result) return round
  return { ...round, events: round.events.map((current, at) => (at === index ? update(current) : current)) }
}

const isPlayer = (round: RoundState, player: PlayerId) => round.players.some(({ id }) => id === player)

const isRoundMessage = (message: RoomMessage): message is RoundMessage =>
  message.type !== 'emote' && message.type !== 'status' && message.type !== 'sync'

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
      settings: message.settings,
      draftSeconds: message.seconds,
      startedAt: now,
      teams: {},
      match: null,
      events: Array.from({ length: message.settings.games.length }, emptyEvent),
      surrendered: null,
    }
  }
  if (!round || !isRoundMessage(message) || message.round !== round.id) return round

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
    case 'eventReady':
      if (!isPlayer(round, message.player)) return round
      return updateEvent(round, message.event, (event) => {
        if (event.ready.includes(message.player)) return event
        const ready = [...event.ready, message.player]
        return { ...event, openedAt: event.openedAt ?? now, ready, readyAt: ready.length >= 2 ? now : null }
      })
    case 'move': {
      const player = playerIndex(round, message.player)
      if (player === null) return round
      return updateEvent(round, message.event, (event) => {
        const moves: [Moves, Moves] = [event.moves[0], event.moves[1]]
        moves[player] = withMove(event.moves[player], message.step, message.value)
        return { ...event, moves }
      })
    }
    case 'eventResult':
      return updateEvent(round, message.event, (event) => ({ ...event, result: message.result }))
    case 'surrender':
      return round.surrendered || !isPlayer(round, message.player) ? round : { ...round, surrendered: message.player }
  }
}

const shiftTime = (time: number | null, by: number) => (time === null ? null : time + by)

/** A round from another player's clock moved onto this one: every time `by` ms later. */
export function shiftRound(round: RoundState, by: number): RoundState {
  return {
    ...round,
    startedAt: round.startedAt + by,
    match: round.match && { ...round.match, startedAt: round.match.startedAt + by },
    events: round.events.map((event) => ({ ...event, openedAt: shiftTime(event.openedAt, by), readyAt: shiftTime(event.readyAt, by) })),
  }
}

const union = <T>(mine: readonly T[], theirs: readonly T[]): T[] => [...mine, ...theirs.filter((entry) => !mine.includes(entry))]

const mergeMoves = (mine: Moves, theirs: Moves): Moves =>
  Array.from({ length: Math.max(mine.length, theirs.length) }, (_, step) => mine[step] ?? theirs[step])

function mergeEvent(mine: LiveEventState, theirs: LiveEventState | undefined): LiveEventState {
  if (!theirs) return mine
  return {
    openedAt: mine.openedAt ?? theirs.openedAt,
    arrived: union(mine.arrived, theirs.arrived),
    ready: union(mine.ready, theirs.ready),
    readyAt: mine.readyAt ?? theirs.readyAt,
    moves: [mergeMoves(mine.moves[0], theirs.moves[0]), mergeMoves(mine.moves[1], theirs.moves[1])],
    result: mine.result ?? theirs.result,
  }
}

/**
 * Adds what another player saw of the same round to this one: messages missed while
 * reconnecting. Both saw the same messages in the same order, so nothing ever conflicts: the
 * first answer counts on both sides, and what this player already has stays.
 */
export function mergeRounds(mine: RoundState, theirs: RoundState): RoundState {
  if (mine.id !== theirs.id) return mine
  return {
    ...mine,
    teams: { ...theirs.teams, ...mine.teams },
    match: mine.match ?? theirs.match,
    events: mine.events.map((event, index) => mergeEvent(event, theirs.events[index])),
    surrendered: mine.surrendered ?? theirs.surrendered,
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

/** When a live event's game starts: once both are ready, or when the intro time is up. */
export function eventStart(event: Pick<LiveEventState, 'openedAt' | 'readyAt'>): number | null {
  if (event.readyAt !== null) return event.readyAt
  return event.openedAt === null ? null : event.openedAt + TIMINGS.intro * 1000
}

export interface HostContext {
  now: number
  /** Ids of the players connected right now. */
  online: readonly PlayerId[]
  /** When each player who is not connected was last seen (local time, ms). */
  goneSince: Partial<Record<PlayerId, number>>
  random: RandomFn
  /** A random full team, for a player who never sent theirs. */
  randomTeam: () => EncodedTeam
}

const seconds = (value: number) => value * 1000

const goneFor = (player: PlayerId, limit: number, { now, goneSince }: HostContext): boolean => {
  const since = goneSince[player]
  return since !== undefined && now - since >= seconds(limit)
}

/**
 * What the host sends next, if anything: a surrender for a player gone too long, the match start
 * once both teams are in (or the draft time is up), and each live event's result once the
 * mini-game is decided. A player who is gone or out of time never holds the game up: the host
 * fills in their missing moves with poor ones.
 */
export function hostMessages(round: RoundState, context: HostContext): RoomMessage[] {
  if (round.surrendered) return []
  const gone = round.players.find(({ id }) => goneFor(id, TIMINGS.gone, context))
  if (gone) return [{ type: 'surrender', round: round.id, player: gone.id }]
  if (!round.match) return draftMessages(round, context)
  const index = round.events.findIndex((event) => !event.result)
  const event = round.events[index]
  return event ? eventMessages(round, index, event, context) : []
}

function draftMessages(round: RoundState, { now, online, random, randomTeam }: HostContext): RoomMessage[] {
  const timeUp = now >= round.startedAt + seconds(round.draftSeconds + TIMINGS.draftGrace)
  const teams = round.players.map(({ id }) => round.teams[id] ?? (timeUp || !online.includes(id) ? randomTeam() : undefined))
  if (!teams.every((team) => team !== undefined)) return []
  return [{ type: 'startMatch', round: round.id, seed: Math.floor(random() * 2 ** 32), teams }]
}

function eventMessages(round: RoundState, index: number, event: LiveEventState, context: HostContext): RoomMessage[] {
  const live = roundEvents(round)[index]
  const start = eventStart(event)
  if (!round.match || !live || start === null) return []
  const rules = MINI_GAME_RULES[live.game]
  const setup = eventSetup(round.match.seed, index, live.late, round.settings.bothRoles)

  const settled = rules.settle(event.moves, setup)
  if (settled) {
    const result: EventResult = {
      winner: eventWinner(settled.winner, round.match.seed, index),
      scores: { blue: settled.scores[0], red: settled.scores[1] },
      tie: settled.winner === null,
    }
    return [{ type: 'eventResult', round: round.id, event: index, result }]
  }

  const timeUp = context.now >= start + seconds(TIMINGS.opening + rules.liveSeconds(setup) + TIMINGS.eventGrace)
  return rules.owed(event.moves, setup).flatMap((owed) => {
    const player = round.players[owed.player]
    if (!player || !(timeUp || goneFor(player.id, TIMINGS.offline, context))) return []
    const value = rules.fallback(owed, event.moves, setup)
    return [{ type: 'move', round: round.id, event: index, player: player.id, step: owed.step, value } satisfies RoomMessage]
  })
}
