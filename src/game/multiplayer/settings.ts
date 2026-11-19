import { isMiniGameId, MINI_GAME_IDS, type MiniGameId } from '../minigames/catalog'
import { sample, type RandomFn } from '../random'
import type { GameRules } from '../rules'

/**
 * Lobby settings, chosen by the host (the player who created the game). Both players see them.
 * - mode: `draft` drafts a team (rolling champions and items like Classic), then a live match
 *   with the mini-games as live events. `lanes` ("Minigames", no champ select) skips the draft:
 *   both get a random team, and the five lanes fight it out in five mini-games (random, or the
 *   host picks exactly five).
 * - rerolls (draft only): 3 champion and 3 item rerolls, or none.
 * - events: none (draft only: the higher team rating wins, no match is played), 3 or 5 random
 *   mini-games, or a custom list. They are rolled in the lobby, so both players see which games
 *   they will play.
 * - bothRoles: in role games (hide/guess, plant/walk, gate/guard) each player plays each role. Still one event.
 * - animations: the winner's finisher animation after each live event.
 */
export type GameMode = 'draft' | 'lanes'
export type EventMode = 'none' | 'random3' | 'random5' | 'custom'

export interface LobbySettings {
  mode: GameMode
  rerolls: boolean
  eventMode: EventMode
  /** The mini-games of the match, in the order chosen. Empty when the event mode is `none`. */
  games: MiniGameId[]
  bothRoles: boolean
  animations: boolean
}

export const RANDOM_EVENT_COUNT: Record<Exclude<EventMode, 'none' | 'custom'>, number> = { random3: 3, random5: 5 }

/** A draft battle without live events: no match is played, the higher team rating wins. */
export const isTeamOnly = (settings: Pick<LobbySettings, 'mode' | 'eventMode'>): boolean =>
  settings.mode === 'draft' && settings.eventMode === 'none'

/** Seconds to draft a team. */
export const DRAFT_SECONDS = 90

/** The lanes mode always plays this many mini-games: one per lane. */
export const LANE_GAMES = RANDOM_EVENT_COUNT.random5

export const randomGames = (count: number, random?: RandomFn): MiniGameId[] => sample(MINI_GAME_IDS, count, random)

/** A draft battle, rerolls on, no live events (team rating decides), one role each, finisher animations off. */
export function defaultSettings(): LobbySettings {
  return { mode: 'draft', rerolls: true, eventMode: 'none', games: [], bothRoles: false, animations: false }
}

/** The lanes mode plays exactly 5 mini-games: it starts on 5 random ones (or keeps 5 already chosen). */
export function withMode(settings: LobbySettings, mode: GameMode, random?: RandomFn): LobbySettings {
  if (mode === 'draft') return { ...settings, mode }
  if (settings.games.length === LANE_GAMES && (settings.eventMode === 'random5' || settings.eventMode === 'custom')) return { ...settings, mode }
  return { ...settings, mode, eventMode: 'random5', games: randomGames(LANE_GAMES, random) }
}

/** The settings can start a game: the lanes mode needs exactly one mini-game per lane. */
export const settingsReady = (settings: LobbySettings): boolean =>
  settings.mode === 'lanes' ? settings.games.length === LANE_GAMES : isTeamOnly(settings) || settings.games.length > 0

/**
 * The settings after choosing an event mode: none clears the games, random modes roll new ones,
 * custom keeps the current ones (or starts from 3 random ones when there are none).
 */
export function withEventMode(settings: LobbySettings, eventMode: EventMode, random?: RandomFn): LobbySettings {
  if (settings.mode === 'lanes' && (eventMode === 'random3' || eventMode === 'none')) return settings
  if (eventMode === 'none') return { ...settings, eventMode, games: [] }
  if (eventMode === 'custom') {
    return { ...settings, eventMode, games: settings.games.length > 0 ? settings.games : randomGames(RANDOM_EVENT_COUNT.random3, random) }
  }
  return { ...settings, eventMode, games: randomGames(RANDOM_EVENT_COUNT[eventMode], random) }
}

/** Custom mode: switches one game on or off. At least one game stays on; the lanes mode holds at most 5. */
export function toggleGame(settings: LobbySettings, game: MiniGameId): LobbySettings {
  const on = settings.games.includes(game)
  if (on && settings.games.length === 1) return settings
  if (!on && settings.mode === 'lanes' && settings.games.length >= LANE_GAMES) return settings
  const games = on ? settings.games.filter((id) => id !== game) : MINI_GAME_IDS.filter((id) => id === game || settings.games.includes(id))
  return { ...settings, eventMode: 'custom', games }
}

/** The draft rules for the settings. */
export function draftRules({ rerolls }: LobbySettings): GameRules {
  const count = rerolls ? 3 : 0
  return { championRerolls: count, itemRerolls: count }
}

const MODES: readonly GameMode[] = ['draft', 'lanes']
const EVENT_MODES: readonly EventMode[] = ['none', 'random3', 'random5', 'custom']

/** Checks settings from the network: anything malformed is dropped. */
export function parseSettings(value: unknown): LobbySettings | null {
  if (typeof value !== 'object' || value === null) return null
  const { mode = 'draft', rerolls, eventMode, games, bothRoles, animations = false } = value as Record<string, unknown>
  if (!MODES.includes(mode as GameMode) || !EVENT_MODES.includes(eventMode as EventMode)) return null
  if (typeof rerolls !== 'boolean' || typeof bothRoles !== 'boolean' || typeof animations !== 'boolean') return null
  if (!Array.isArray(games) || games.length > MINI_GAME_IDS.length || !games.every(isMiniGameId)) return null
  if (new Set(games).size !== games.length) return null
  const parsed: LobbySettings = { mode: mode as GameMode, rerolls, eventMode: eventMode as EventMode, games, bothRoles, animations }
  // Only "no live events" has no games, and it has none at all.
  if (isTeamOnly(parsed) !== (games.length === 0) || (parsed.mode === 'lanes' && parsed.eventMode === 'none')) return null
  return parsed
}
