import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { parsePresence, parseRoomMessage, type PresenceInfo, type RoomMessage } from '../game/multiplayer/protocol'
import { dailyStatsConfig } from './dailyStats'

/**
 * Multiplayer lobbies over Supabase Realtime: Broadcast passes messages between the two players
 * and Presence shows who is connected. Nothing is stored: a lobby lives only while someone is in it.
 *
 * Presence is tracked once per connection and never updated: Supabase closes the channel of a
 * client that sends more than 5 Presence updates in 30 seconds. Everything that changes (ready,
 * settings, names) goes over Broadcast instead.
 */
let client: SupabaseClient | null = null

function supabase(): SupabaseClient | null {
  const config = dailyStatsConfig()
  if (!config) return null
  client ??= createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}

/** Multiplayer needs the same two env variables as the Daily stats. */
export const isMultiplayerAvailable = (): boolean => dailyStatsConfig() !== null

/** `error` only when the lobby never connected; a lost connection is `reconnecting` until it is back. */
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error'

export interface RoomHandlers {
  onMessage: (message: RoomMessage) => void
  /** Everyone connected to the lobby right now. */
  onPresence: (present: PresenceInfo[]) => void
  /** `connected` comes again after every reconnect. */
  onStatus: (status: ConnectionStatus) => void
}

export interface RoomConnection {
  /** Sends at once, or as soon as the connection is back. */
  send: (message: RoomMessage) => void
  leave: () => void
}

const MESSAGE_EVENT = 'message'
/** Tries before a lobby that never connected shows an error. */
const FIRST_ATTEMPTS = 4
const MAX_RETRY_MS = 8000

const retryDelay = (attempt: number) => Math.min(MAX_RETRY_MS, 500 * 2 ** attempt)

export function joinRoom(code: string, presence: PresenceInfo, handlers: RoomHandlers): RoomConnection | null {
  const realtime = supabase()
  if (!realtime) return null

  let channel: RealtimeChannel | null = null
  let subscribed = false
  let left = false
  let everConnected = false
  let attempts = 0
  let retry: number | undefined
  const queue: RoomMessage[] = []

  const push = (target: RealtimeChannel, message: RoomMessage) => {
    void target.send({ type: 'broadcast', event: MESSAGE_EVENT, payload: message })
  }

  const open = () => {
    const current = realtime.channel(`rift-room-${code}`, {
      // Every player, the sender too, applies every message in the same way.
      config: { broadcast: { self: true }, presence: { key: presence.id } },
    })
    channel = current
    subscribed = false
    current
      .on('broadcast', { event: MESSAGE_EVENT }, ({ payload }: { payload: unknown }) => {
        const message = parseRoomMessage(payload)
        if (message) handlers.onMessage(message)
      })
      .on('presence', { event: 'sync' }, () => {
        const present = Object.values(current.presenceState()).flat()
        handlers.onPresence(present.flatMap((entry) => parsePresence(entry) ?? []))
      })
      .subscribe((state) => {
        if (left || channel !== current) return
        if (state === 'SUBSCRIBED') {
          subscribed = true
          everConnected = true
          attempts = 0
          void current.track({ ...presence })
          handlers.onStatus('connected')
          for (const message of queue.splice(0)) push(current, message)
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          reopen()
        }
      })
  }

  /** A fresh channel after a short wait. The old one is removed first, or Supabase would hand it back. */
  const reopen = () => {
    const old = channel
    channel = null
    subscribed = false
    attempts += 1
    if (!everConnected && attempts > FIRST_ATTEMPTS) {
      handlers.onStatus('error')
      if (old) void realtime.removeChannel(old)
      return
    }
    handlers.onStatus(everConnected ? 'reconnecting' : 'connecting')
    const removed = old ? realtime.removeChannel(old) : Promise.resolve()
    void removed.finally(() => {
      if (!left) retry = window.setTimeout(open, retryDelay(attempts))
    })
  }

  open()

  return {
    send: (message) => {
      if (channel && subscribed) push(channel, message)
      else queue.push(message)
    },
    leave: () => {
      left = true
      window.clearTimeout(retry)
      if (channel) void realtime.removeChannel(channel)
      channel = null
    },
  }
}
