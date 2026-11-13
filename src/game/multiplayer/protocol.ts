import type { Side } from '../match/types'
import type { Moves } from '../minigames/versus'
import type { LiveEventState, RoundState } from './session'
import { parseSettings, type LobbySettings } from './settings'
import { isEncodedTeam, type EncodedTeam } from './teamCode'

/** A random id per browser tab, so two tabs can play each other while testing. */
export type PlayerId = string

export interface PlayerInfo {
  id: PlayerId
  name: string
}

/**
 * Who is connected (Supabase Presence). Sent once per connection and never updated: Supabase
 * allows a client only a few Presence updates (5 per 30 seconds) and closes the channel after that.
 */
export interface PresenceInfo {
  id: PlayerId
  /** When they first opened the lobby. The earliest player is the host. */
  joinedAt: number
}

/** What a player shares about themselves. It changes often, so it goes over Broadcast. */
export interface PlayerStatus {
  name: string
  /** Pressed Ready in the lobby, or Rematch after a game. */
  ready: boolean
  /** In a draft or a match right now. */
  playing: boolean
  /** The lobby settings. Only the host's count; both players see them. */
  settings?: LobbySettings
}

/** A player in the lobby: connected (Presence) with their latest status (Broadcast). */
export interface LobbyPlayer extends PresenceInfo, PlayerStatus {}

/** Shown until a player's first status arrives. */
export const UNKNOWN_STATUS: PlayerStatus = { name: 'Joining…', ready: false, playing: false }

/** Spam them. Both players see every one. */
export const EMOTES = ['GG', 'EZ', 'WP', '?', 'FF', '💀', '😂', '🔥'] as const
export type Emote = (typeof EMOTES)[number]

/** Limits for mini-game moves from the network: whole numbers (times in ms, gold, packed choices). */
export const MOVE_LIMITS = { maxValue: 10_000_000, maxStep: 64, maxEvent: 16 } as const

/**
 * Every message in a lobby. The host sends the ones that move the game along (startDraft,
 * startMatch, eventResult) and fills in moves for a player who doesn't answer in time.
 */
export type RoomMessage =
  | { type: 'startDraft'; round: string; seconds: number; players: PlayerInfo[]; settings: LobbySettings }
  | { type: 'team'; round: string; player: PlayerId; team: EncodedTeam }
  | { type: 'startMatch'; round: string; seed: number; teams: EncodedTeam[] }
  /** A player reached a live event: the intro with the tutorial is showing. */
  | { type: 'arrived'; round: string; event: number; player: PlayerId }
  /** A player pressed Ready on the intro. The game starts when both have, or after the intro time. */
  | { type: 'eventReady'; round: string; event: number; player: PlayerId }
  /** One mini-game move (see src/game/minigames/versus.ts). */
  | { type: 'move'; round: string; event: number; player: PlayerId; step: number; value: number }
  | { type: 'eventResult'; round: string; event: number; result: EventResult }
  | { type: 'surrender'; round: string; player: PlayerId }
  | { type: 'emote'; player: PlayerId; emote: Emote }
  /**
   * A player's status, sent when it changes. `hello` on (re)connecting asks the others for theirs,
   * and for the round in play if the sender is in it.
   */
  | { type: 'status'; player: PlayerId; status: PlayerStatus; hello: boolean }
  /** The round so far, for a player who reconnected (`sentAt` corrects for clock differences). */
  | { type: 'sync'; to: PlayerId; sentAt: number; state: RoundState }

/** The messages that change a round (the rest are about the lobby). */
export type RoundMessage = Exclude<RoomMessage, { type: 'emote' | 'status' | 'sync' }>

/** How a live event ended: the winning side (a tie goes to a coin flip) and both scores. */
export interface EventResult {
  winner: Side
  scores: Record<Side, number>
  /** The scores were equal and a coin flip decided. */
  tie: boolean
}

type Fields = Record<string, unknown>

const isObject = (value: unknown): value is Fields => typeof value === 'object' && value !== null
const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length < 100
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0
const isBelow = (limit: number) => (value: unknown): value is number => isCount(value) && value < limit
const isSide = (value: unknown): value is Side => value === 'blue' || value === 'red'
const isEmote = (value: unknown): value is Emote => typeof value === 'string' && (EMOTES as readonly string[]).includes(value)
const isMoveValue = (value: unknown): value is number => isCount(value) && value <= MOVE_LIMITS.maxValue
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isTimeOrNull = (value: unknown): value is number | null => value === null || isTime(value)
const isIdList = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 2 && value.every(isString)

const isPlayerInfo = (value: unknown): value is PlayerInfo => isObject(value) && isString(value.id) && isString(value.name)

function isEventResult(value: unknown): value is EventResult {
  if (!isObject(value) || !isSide(value.winner) || typeof value.tie !== 'boolean') return false
  const { scores } = value
  return isObject(scores) && isMoveValue(scores.blue) && isMoveValue(scores.red)
}

/** Checks a message from the network. Anything malformed (or from an older version) is dropped. */
export function parseRoomMessage(value: unknown): RoomMessage | null {
  if (!isObject(value)) return null
  const message = value
  const inRound = isString(message.round)
  const atEvent = inRound && isBelow(MOVE_LIMITS.maxEvent)(message.event)
  const fromPlayer = isString(message.player)
  switch (message.type) {
    case 'startDraft':
      return inRound &&
        isCount(message.seconds) &&
        Array.isArray(message.players) &&
        message.players.length === 2 &&
        message.players.every(isPlayerInfo) &&
        parseSettings(message.settings) !== null
        ? (message as RoomMessage)
        : null
    case 'team':
      return inRound && fromPlayer && isEncodedTeam(message.team) ? (message as RoomMessage) : null
    case 'startMatch':
      return inRound &&
        isCount(message.seed) &&
        Array.isArray(message.teams) &&
        message.teams.length === 2 &&
        message.teams.every(isEncodedTeam)
        ? (message as RoomMessage)
        : null
    case 'arrived':
    case 'eventReady':
      return atEvent && fromPlayer ? (message as RoomMessage) : null
    case 'move':
      return atEvent && fromPlayer && isBelow(MOVE_LIMITS.maxStep)(message.step) && isMoveValue(message.value)
        ? (message as RoomMessage)
        : null
    case 'eventResult':
      return atEvent && isEventResult(message.result) ? (message as RoomMessage) : null
    case 'surrender':
      return inRound && fromPlayer ? (message as RoomMessage) : null
    case 'emote':
      return fromPlayer && isEmote(message.emote) ? (message as RoomMessage) : null
    case 'status': {
      const status = parseStatus(message.status)
      return fromPlayer && status && typeof message.hello === 'boolean'
        ? { type: 'status', player: message.player as PlayerId, status, hello: message.hello }
        : null
    }
    case 'sync': {
      const state = parseRoundState(message.state)
      return isString(message.to) && isTime(message.sentAt) && state
        ? { type: 'sync', to: message.to, sentAt: message.sentAt, state }
        : null
    }
    default:
      return null
  }
}

/** A status from the network. Settings from another version are dropped, never the player. */
export function parseStatus(value: unknown): PlayerStatus | null {
  if (!isObject(value) || !isString(value.name) || typeof value.ready !== 'boolean' || typeof value.playing !== 'boolean') return null
  const settings = value.settings === undefined ? null : parseSettings(value.settings)
  return { name: value.name, ready: value.ready, playing: value.playing, ...(settings ? { settings } : {}) }
}

export function parsePresence(value: unknown): PresenceInfo | null {
  if (!isObject(value) || !isString(value.id) || !isTime(value.joinedAt)) return null
  return { id: value.id, joinedAt: value.joinedAt }
}

/** Moves from JSON, where a hole (a step not played yet) arrives as null. */
function parseMoves(value: unknown): Moves | null {
  if (!Array.isArray(value) || value.length > MOVE_LIMITS.maxStep) return null
  const moves = value.map((move: unknown) => (move === null ? undefined : move))
  return moves.every((move) => move === undefined || isMoveValue(move)) ? moves : null
}

function parseEventState(value: unknown): LiveEventState | null {
  if (!isObject(value) || !isTimeOrNull(value.openedAt) || !isTimeOrNull(value.readyAt)) return null
  if (!isIdList(value.arrived) || !isIdList(value.ready)) return null
  if (value.result !== null && !isEventResult(value.result)) return null
  const moves = Array.isArray(value.moves) && value.moves.length === 2 ? value.moves.map(parseMoves) : []
  const [host, guest] = moves
  if (!host || !guest) return null
  return { openedAt: value.openedAt, arrived: value.arrived, ready: value.ready, readyAt: value.readyAt, moves: [host, guest], result: value.result }
}

function parseMatch(value: unknown): RoundState['match'] | undefined {
  if (value === null) return null
  if (!isObject(value) || !isCount(value.seed) || !isTime(value.startedAt)) return undefined
  const { teams } = value
  if (!Array.isArray(teams) || teams.length !== 2 || !teams.every(isEncodedTeam)) return undefined
  return { seed: value.seed, teams, startedAt: value.startedAt }
}

/** A whole round from the network (a sync). Anything malformed drops the lot. */
export function parseRoundState(value: unknown): RoundState | null {
  if (!isObject(value) || !isString(value.id) || !isCount(value.draftSeconds) || !isTime(value.startedAt)) return null
  const { players, teams, events, surrendered } = value
  if (!Array.isArray(players) || players.length !== 2 || !players.every(isPlayerInfo)) return null
  const settings = parseSettings(value.settings)
  const match = parseMatch(value.match)
  if (!settings || match === undefined || (surrendered !== null && !isString(surrendered))) return null
  if (!isObject(teams) || !Object.entries(teams).every(([id, team]) => players.some((player) => player.id === id) && isEncodedTeam(team))) return null
  if (!Array.isArray(events) || events.length !== settings.games.length) return null
  const eventStates = events.map(parseEventState)
  if (!eventStates.every((event) => event !== null)) return null
  return {
    id: value.id,
    players: players.map(({ id, name }) => ({ id, name })),
    settings,
    draftSeconds: value.draftSeconds,
    startedAt: value.startedAt,
    teams: teams as RoundState['teams'],
    match,
    events: eventStates,
    surrendered,
  }
}

/**
 * The two players of a lobby, host first: the earliest to join (ties by id), with their latest
 * status. Anyone after the first two is a spectator who sees "lobby full". A player connected
 * twice (a reload before the old connection timed out) counts once.
 */
export function lobbyPlayers(present: readonly PresenceInfo[], statuses: Readonly<Partial<Record<PlayerId, PlayerStatus>>> = {}): LobbyPlayer[] {
  const unique = new Map<PlayerId, PresenceInfo>()
  for (const player of present) {
    const known = unique.get(player.id)
    if (!known || player.joinedAt < known.joinedAt) unique.set(player.id, player)
  }
  return [...unique.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
    .slice(0, 2)
    .map((player) => ({ ...(statuses[player.id] ?? UNKNOWN_STATUS), ...player }))
}
