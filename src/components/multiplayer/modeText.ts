import type { GameMode } from '../../game/multiplayer/settings'

/** What each game mode is called in the lobby. */
export const MODE_TEXT: Record<GameMode, { label: string; hint: string }> = {
  draft: { label: 'Draft battle', hint: 'Draft a team, then a live match with mini-games' },
  lanes: { label: 'Five lanes', hint: 'No champ select: 5 lanes, 5 mini-games, 5 lives' },
}
