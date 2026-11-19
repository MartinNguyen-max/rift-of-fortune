import type { GameMode } from '../../game/multiplayer/settings'

/** What each game mode is called in the lobby. */
export const MODE_TEXT: Record<GameMode, { label: string; hint: string }> = {
  draft: { label: 'Draft battle', hint: 'Draft a team, then fight it out' },
  lanes: { label: 'Minigames', hint: 'No champ select: 5 mini-games, 5 lives' },
}
