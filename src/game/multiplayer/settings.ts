import { isMiniGameId, MINI_GAME_IDS, type MiniGameId } from '../minigames/catalog'
import { sample, type RandomFn } from '../random'
import type { GameRules } from '../rules'

/**
 * Lobby settings, chosen by the host (the player who created the game). Both players see them.
 * - mode: `draft` drafts a team (rolling champions and items like Classic), then a live match
 *   with the mini-games as live events. `lanes` ("Five lanes, no champ select") skips the draft:
 *   both get a random team, and the five lanes fight it out in five random mini-games.
 * - rerolls (draft only): 3 champion and 3 item rerolls, or none.
 * - events: 3 or 5 random mini-games, or a custom list. They are rolled in the lobby, so both
 *   players see which games they will play.
 * - bothRoles: in role games (hide/guess, plant/walk, gate/guard) each player plays each role. Still one event.
 * - animations: the winner's finisher animation after each live event.
 */
export type GameMode = 'draft' | 'lanes'
export type EventMode = 'random3' | 'random5' | 'custom'

export interface LobbySettings {
  mode: GameMode
  rerolls: boolean
  eventMode: EventMode
  /** The mini-games of the match, in the order chosen. */
  games: MiniGameId[]
  bothRoles: boolean
  animations: boolean
}

export const RANDOM_EVENT_COUNT: Record<Exclude<EventMode, 'custom'>, number> = { random3: 3, random5: 5 }

/** Seconds to draft a team. */
export const DRAFT_SECONDS = 90

/** Five lanes always plays this many random mini-games: one per lane. */
export const LANE_GAMES = RANDOM_EVENT_COUNT.random5

export const randomGames = (count: number, random?: RandomFn): MiniGameId[] => sample(MINI_GAME_IDS, count, random)

/** A draft battle, rerolls on, 3 random mini-games, one role each, finisher animations on. */
export function defaultSettings(random?: RandomFn): LobbySettings {
  return { mode: 'draft', rerolls: true, eventMode: 'random3', games: randomGames(3, random), bothRoles: false, animations: true }
}

/** Five lanes is locked to 5 random mini-games (they can still be shuffled). */
export function withMode(settings: LobbySettings, mode: GameMode, random?: RandomFn): LobbySettings {
  if (mode === 'draft') return { ...settings, mode }
  const games = settings.eventMode === 'random5' ? settings.games : randomGames(LANE_GAMES, random)
  return { ...settings, mode, eventMode: 'random5', games }
}

/** The settings after choosing an event mode: random modes roll new games, custom keeps the current ones. */
export function withEventMode(settings: LobbySettings, eventMode: EventMode, random?: RandomFn): LobbySettings {
  if (settings.mode === 'lanes' && eventMode !== 'random5') return settings
  if (eventMode === 'custom') return { ...settings, eventMode }
  return { ...settings, eventMode, games: randomGames(RANDOM_EVENT_COUNT[eventMode], random) }
}

/** Custom mode: switches one game on or off. At least one game stays on. */
export function toggleGame(settings: LobbySettings, game: MiniGameId): LobbySettings {
  if (settings.mode === 'lanes') return settings
  const on = settings.games.includes(game)
  if (on && settings.games.length === 1) return settings
  const games = on ? settings.games.filter((id) => id !== game) : MINI_GAME_IDS.filter((id) => id === game || settings.games.includes(id))
  return { ...settings, eventMode: 'custom', games }
}

/** The draft rules for the settings. */
export function draftRules({ rerolls }: LobbySettings): GameRules {
  const count = rerolls ? 3 : 0
  return { championRerolls: count, itemRerolls: count }
}

const MODES: readonly GameMode[] = ['draft', 'lanes']
const EVENT_MODES: readonly EventMode[] = ['random3', 'random5', 'custom']

/** Checks settings from the network: anything malformed is dropped. */
export function parseSettings(value: unknown): LobbySettings | null {
  if (typeof value !== 'object' || value === null) return null
  const { mode = 'draft', rerolls, eventMode, games, bothRoles, animations = true } = value as Record<string, unknown>
  if (!MODES.includes(mode as GameMode) || !EVENT_MODES.includes(eventMode as EventMode)) return null
  if (typeof rerolls !== 'boolean' || typeof bothRoles !== 'boolean' || typeof animations !== 'boolean') return null
  if (!Array.isArray(games) || games.length === 0 || games.length > MINI_GAME_IDS.length || !games.every(isMiniGameId)) return null
  if (new Set(games).size !== games.length) return null
  return { mode: mode as GameMode, rerolls, eventMode: eventMode as EventMode, games, bothRoles, animations }
}
