/**
 * Small wrappers around localStorage. Storage can be missing or blocked (private windows,
 * strict privacy settings), so every call is guarded and the game works without it.
 */
const PREFIX = 'rift-of-fortune:'

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? null : (JSON.parse(raw) as T)
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage is unavailable; progress just isn't saved.
  }
}

/** A random, anonymous id for this browser. Used only to allow one Daily score per player. */
export function playerId(): string {
  const existing = readJson<string>('player-id')
  if (existing) return existing
  const id = crypto.randomUUID()
  writeJson('player-id', id)
  return id
}
