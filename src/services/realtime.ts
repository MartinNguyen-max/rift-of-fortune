import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { parsePresence, parseRoomMessage, type PresenceInfo, type RoomMessage } from '../game/multiplayer/protocol'
import { dailyStatsConfig } from './dailyStats'

/**
 * Multiplayer lobbies over Supabase Realtime: Broadcast passes messages between the two players
 * and Presence shows who is connected. Nothing is stored: a lobby lives only while someone is in it.
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

export type ConnectionStatus = 'connecting' | 'connected' | 'error'

export interface RoomHandlers {
  onMessage: (message: RoomMessage) => void
  /** Everyone connected to the lobby right now. */
  onPresence: (present: PresenceInfo[]) => void
  onStatus: (status: ConnectionStatus) => void
}

export interface RoomConnection {
  send: (message: RoomMessage) => void
  /** Shares new info about this player (ready, playing) with the lobby. */
  updatePresence: (presence: PresenceInfo) => void
  leave: () => void
}

const MESSAGE_EVENT = 'message'

export function joinRoom(code: string, presence: PresenceInfo, handlers: RoomHandlers): RoomConnection | null {
  const realtime = supabase()
  if (!realtime) return null

  let current = presence
  let subscribed = false
  const channel = realtime.channel(`rift-room-${code}`, {
    // Every player, the sender too, applies every message in the same way.
    config: { broadcast: { self: true }, presence: { key: presence.id } },
  })

  channel
    .on('broadcast', { event: MESSAGE_EVENT }, ({ payload }: { payload: unknown }) => {
      const message = parseRoomMessage(payload)
      if (message) handlers.onMessage(message)
    })
    .on('presence', { event: 'sync' }, () => {
      const present = Object.values(channel.presenceState()).flat()
      handlers.onPresence(present.flatMap((entry) => parsePresence(entry) ?? []))
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        subscribed = true
        void channel.track({ ...current })
        handlers.onStatus('connected')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        handlers.onStatus('error')
      }
    })

  return {
    send: (message) => {
      void channel.send({ type: 'broadcast', event: MESSAGE_EVENT, payload: message })
    },
    updatePresence: (next) => {
      current = next
      if (subscribed) void channel.track({ ...next })
    },
    leave: () => {
      void realtime.removeChannel(channel)
    },
  }
}
