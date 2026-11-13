import type { Pace } from '../../game/multiplayer/settings'

/** What each pace is called in the lobby and the draft. */
export const PACE_TEXT: Record<Pace, { label: string; hint: string }> = {
  normal: { label: 'Draft battle', hint: 'Roll champs and items. The best team has the edge' },
  fast: { label: 'Settle it in fights', hint: '5 champs + 10 items at once. The live events decide' },
}
