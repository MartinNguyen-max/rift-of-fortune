import type { Side } from '../match/types'
import { parseSettings, type LobbySettings } from './settings'
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
  /** The lobby settings. Only the host's count; both players see them. */
  settings?: LobbySettings
}

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
    default:
      return null
  }
}

export function parsePresence(value: unknown): PresenceInfo | null {
  if (!isPlayerInfo(value)) return null
  const fields = value as unknown as Fields
  const { joinedAt, ready, playing } = fields
  if (typeof joinedAt !== 'number' || typeof ready !== 'boolean' || typeof playing !== 'boolean') return null
  const settings = fields.settings === undefined ? undefined : parseSettings(fields.settings)
  if (settings === null) return null
  return { id: value.id, name: value.name, joinedAt, ready, playing, ...(settings ? { settings } : {}) }
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
