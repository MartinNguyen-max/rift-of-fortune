import { LANES, type Lane, type Side } from '../match/types'
import { isEncodedTeam, type EncodedTeam } from './teamCode'

/** A random id per browser tab, so two tabs can play each other while testing. */
export type PlayerId = string

export interface PlayerInfo {
  id: PlayerId
  name: string
}

/** What each player shares about themselves while connected (Supabase Presence). */
export interface PresenceInfo extends PlayerInfo {
  /** When they opened the lobby. The earliest player is the host. */
  joinedAt: number
  /** Pressed Ready in the lobby, or Rematch after a game. */
  ready: boolean
  /** In a draft or a match right now. */
  playing: boolean
}

/** Spam them. Both players see every one. */
export const EMOTES = ['GG', 'EZ', 'WP', '?', 'FF', '💀', '😂', '🔥'] as const
export type Emote = (typeof EMOTES)[number]

/**
 * Every message in a lobby. The host sends the ones that move the game along (startDraft,
 * startMatch, eventResult) and fills in for a player who doesn't answer in time.
 */
export type RoomMessage =
  | { type: 'startDraft'; round: string; seconds: number; players: PlayerInfo[] }
  | { type: 'team'; round: string; player: PlayerId; team: EncodedTeam }
  | { type: 'startMatch'; round: string; seed: number; teams: EncodedTeam[] }
  | { type: 'arrived'; round: string; event: number; player: PlayerId }
  | { type: 'score'; round: string; event: number; player: PlayerId; score: number }
  | { type: 'hide'; round: string; event: number; bush: Lane }
  | { type: 'guess'; round: string; event: number; bush: Lane | null }
  | { type: 'eventResult'; round: string; event: number; result: EventResult }
  | { type: 'surrender'; round: string; player: PlayerId }
  | { type: 'emote'; player: PlayerId; emote: Emote }

/** How a live event ended. `scores` for the duels, `bush` and `guess` for the gank. */
export interface EventResult {
  winner: Side
  scores: Record<Side, number> | null
  bush: Lane | null
  guess: Lane | null
}

type Fields = Record<string, unknown>

const isObject = (value: unknown): value is Fields => typeof value === 'object' && value !== null
const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length < 100
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0
const isSide = (value: unknown): value is Side => value === 'blue' || value === 'red'
const isLane = (value: unknown): value is Lane => typeof value === 'string' && (LANES as readonly string[]).includes(value)
const isEmote = (value: unknown): value is Emote => typeof value === 'string' && (EMOTES as readonly string[]).includes(value)
const isScore = (value: unknown): value is number => isCount(value) && (value as number) <= 100

const isPlayerInfo = (value: unknown): value is PlayerInfo => isObject(value) && isString(value.id) && isString(value.name)

function isEventResult(value: unknown): value is EventResult {
  if (!isObject(value) || !isSide(value.winner)) return false
  const { scores, bush, guess } = value
  const scoresOk = scores === null || (isObject(scores) && isScore(scores.blue) && isScore(scores.red))
  return scoresOk && (bush === null || isLane(bush)) && (guess === null || isLane(guess))
}

/** Checks a message from the network. Anything malformed (or from an older version) is dropped. */
export function parseRoomMessage(value: unknown): RoomMessage | null {
  if (!isObject(value)) return null
  const message = value
  const inRound = isString(message.round)
  const atEvent = inRound && isCount(message.event)
  switch (message.type) {
    case 'startDraft':
      return inRound &&
        isCount(message.seconds) &&
        Array.isArray(message.players) &&
        message.players.length === 2 &&
        message.players.every(isPlayerInfo)
        ? (message as RoomMessage)
        : null
    case 'team':
      return inRound && isString(message.player) && isEncodedTeam(message.team) ? (message as RoomMessage) : null
    case 'startMatch':
      return inRound &&
        isCount(message.seed) &&
        Array.isArray(message.teams) &&
        message.teams.length === 2 &&
        message.teams.every(isEncodedTeam)
        ? (message as RoomMessage)
        : null
    case 'arrived':
      return atEvent && isString(message.player) ? (message as RoomMessage) : null
    case 'score':
      return atEvent && isString(message.player) && isScore(message.score) ? (message as RoomMessage) : null
    case 'hide':
      return atEvent && isLane(message.bush) ? (message as RoomMessage) : null
    case 'guess':
      return atEvent && (message.bush === null || isLane(message.bush)) ? (message as RoomMessage) : null
    case 'eventResult':
      return atEvent && isEventResult(message.result) ? (message as RoomMessage) : null
    case 'surrender':
      return inRound && isString(message.player) ? (message as RoomMessage) : null
    case 'emote':
      return isString(message.player) && isEmote(message.emote) ? (message as RoomMessage) : null
    default:
      return null
  }
}

export function parsePresence(value: unknown): PresenceInfo | null {
  if (!isPlayerInfo(value)) return null
  const fields = value as unknown as Fields
  const { joinedAt, ready, playing } = fields
  if (typeof joinedAt !== 'number' || typeof ready !== 'boolean' || typeof playing !== 'boolean') return null
  return { id: value.id, name: value.name, joinedAt, ready, playing }
}

/**
 * The two players of a lobby, host first: the earliest to join (ties by id). Anyone after the
 * first two is a spectator who sees "lobby full". A player connected twice counts once.
 */
export function lobbyPlayers(present: readonly PresenceInfo[]): PresenceInfo[] {
  const unique = new Map<PlayerId, PresenceInfo>()
  for (const player of present) {
    const known = unique.get(player.id)
    if (!known || player.joinedAt < known.joinedAt) unique.set(player.id, player)
  }
  return [...unique.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
    .slice(0, 2)
}
