import type { PlayerId } from '../game/multiplayer/protocol'
import { parseSettings, type LobbySettings } from '../game/multiplayer/settings'

/**
 * Who this browser tab is in a lobby. Kept in sessionStorage, so a reload is the same player
 * (same id, still host or guest, same name and settings) and can pick the game up again. A new
 * tab is a new player, so two tabs can still play each other while testing.
 */
export interface RoomIdentity {
  id: PlayerId
  joinedAt: number
  name: string
  settings: LobbySettings | null
  wins: Partial<Record<PlayerId, number>>
}

const key = (code: string) => `rift-of-fortune:room:${code}`

function read(code: string): RoomIdentity | null {
  try {
    const raw = sessionStorage.getItem(key(code))
    if (raw === null) return null
    const value = JSON.parse(raw) as Partial<RoomIdentity>
    if (typeof value.id !== 'string' || typeof value.joinedAt !== 'number' || typeof value.name !== 'string') return null
    const wins = typeof value.wins === 'object' && value.wins !== null ? value.wins : {}
    return { id: value.id, joinedAt: value.joinedAt, name: value.name, settings: parseSettings(value.settings), wins }
  } catch {
    return null
  }
}

export function roomIdentity(code: string, fresh: () => RoomIdentity): RoomIdentity {
  const known = read(code)
  if (known) return known
  const identity = fresh()
  saveRoomIdentity(code, identity)
  return identity
}

export function saveRoomIdentity(code: string, identity: RoomIdentity): void {
  try {
    sessionStorage.setItem(key(code), JSON.stringify(identity))
  } catch {
    // Storage is blocked: a reload just joins as a new player.
  }
}

/** Leaving the lobby on purpose: coming back later is a fresh start. */
export function forgetRoomIdentity(code: string): void {
  try {
    sessionStorage.removeItem(key(code))
  } catch {
    // Nothing stored.
  }
}
