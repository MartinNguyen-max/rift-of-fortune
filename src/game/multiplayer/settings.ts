import { isMiniGameId, MINI_GAME_IDS, type MiniGameId } from '../minigames/catalog'
import { sample, type RandomFn } from '../random'
import type { GameRules } from '../rules'

/**
 * Lobby settings, chosen by the host (the player who created the game). Both players see them.
 * - pace: `normal` rolls champions and items like the other modes; `fast` shows 5 champions at
 *   once to place, then all 10 items at once, without roll animations.
 * - rerolls: 3 champion and 3 item rerolls, or none.
 * - events: 3 or 5 random mini-games, or a custom list. They are rolled in the lobby, so both
 *   players see which games they will play.
 * - bothRoles: in role games (hide/guess, plant/walk) each player plays each role. Still one event.
 * - animations: the winner's finisher animation after each live event.
 */
export type Pace = 'normal' | 'fast'
export type EventMode = 'random3' | 'random5' | 'custom'

export interface LobbySettings {
  pace: Pace
  rerolls: boolean
  eventMode: EventMode
  /** The mini-games of the match, in the order chosen. */
  games: MiniGameId[]
  bothRoles: boolean
  animations: boolean
}

export const RANDOM_EVENT_COUNT: Record<Exclude<EventMode, 'custom'>, number> = { random3: 3, random5: 5 }

/** Seconds to draft: the fast pace needs less. */
export const DRAFT_SECONDS: Record<Pace, number> = { normal: 90, fast: 60 }

export const randomGames = (count: number, random?: RandomFn): MiniGameId[] => sample(MINI_GAME_IDS, count, random)

/** Normal pace, rerolls on, 3 random mini-games, one role each, finisher animations on. */
export function defaultSettings(random?: RandomFn): LobbySettings {
  return { pace: 'normal', rerolls: true, eventMode: 'random3', games: randomGames(3, random), bothRoles: false, animations: true }
}

/** The settings after choosing an event mode: random modes roll new games, custom keeps the current ones. */
export function withEventMode(settings: LobbySettings, eventMode: EventMode, random?: RandomFn): LobbySettings {
  if (eventMode === 'custom') return { ...settings, eventMode }
  return { ...settings, eventMode, games: randomGames(RANDOM_EVENT_COUNT[eventMode], random) }
}

/** Custom mode: switches one game on or off. At least one game stays on. */
export function toggleGame(settings: LobbySettings, game: MiniGameId): LobbySettings {
  const on = settings.games.includes(game)
  if (on && settings.games.length === 1) return settings
  const games = on ? settings.games.filter((id) => id !== game) : MINI_GAME_IDS.filter((id) => id === game || settings.games.includes(id))
  return { ...settings, eventMode: 'custom', games }
}

/** The draft rules for the settings. */
export function draftRules({ pace, rerolls }: LobbySettings): GameRules {
  const count = rerolls ? 3 : 0
  return { championRerolls: count, itemRerolls: count, pace }
}

const PACES: readonly Pace[] = ['normal', 'fast']
const EVENT_MODES: readonly EventMode[] = ['random3', 'random5', 'custom']

/** Checks settings from the network: anything malformed is dropped. */
export function parseSettings(value: unknown): LobbySettings | null {
  if (typeof value !== 'object' || value === null) return null
  const { pace, rerolls, eventMode, games, bothRoles, animations = true } = value as Record<string, unknown>
  if (!PACES.includes(pace as Pace) || !EVENT_MODES.includes(eventMode as EventMode)) return null
  if (typeof rerolls !== 'boolean' || typeof bothRoles !== 'boolean' || typeof animations !== 'boolean') return null
  if (!Array.isArray(games) || games.length === 0 || games.length > MINI_GAME_IDS.length || !games.every(isMiniGameId)) return null
  if (new Set(games).size !== games.length) return null
  return { pace: pace as Pace, rerolls, eventMode: eventMode as EventMode, games, bothRoles, animations }
}
