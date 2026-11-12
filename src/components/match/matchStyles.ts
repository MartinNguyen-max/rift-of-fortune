import type { MapSpot, MatchEvent, Side } from '../../game/match/types'

/** Blue is the player's team, red the bot. */
export const SIDE_TEXT: Record<Side, string> = { blue: 'text-hextech', red: 'text-red-400' }
export const SIDE_BORDER: Record<Side, string> = { blue: 'border-hextech/60', red: 'border-red-400/60' }
export const SIDE_BG: Record<Side, string> = { blue: 'bg-hextech', red: 'bg-red-400' }

export function eventIcon({ kind, tags }: Pick<MatchEvent, 'kind' | 'tags'>): string {
  if (tags.includes('escape')) return '💨'
  if (tags.includes('steal')) return '⚡'
  switch (kind) {
    case 'soloKill':
      return '⚔️'
    case 'gank':
      return '🗡️'
    case 'grubs':
      return '🐛'
    case 'herald':
      return '🦀'
    case 'dragon':
      return '🐉'
    case 'tower':
      return '🗼'
    case 'teamfight':
      return '💥'
    case 'baron':
      return '👾'
    case 'elder':
      return '🐲'
    case 'inhibitor':
      return '💠'
    case 'nexus':
      return '💎'
    case 'surrender':
      return '🏳️'
  }
}

/** Where each spot is on the minimap, in percent. Blue's base is bottom left. */
export const SPOT_POSITIONS: Record<MapSpot, { x: number; y: number }> = {
  top: { x: 13, y: 18 },
  mid: { x: 50, y: 50 },
  bot: { x: 82, y: 87 },
  blueJungle: { x: 30, y: 63 },
  redJungle: { x: 70, y: 37 },
  dragon: { x: 67, y: 70 },
  baron: { x: 33, y: 30 },
  blueBase: { x: 13, y: 87 },
  redBase: { x: 87, y: 13 },
}

/** "41.2k". */
export const formatGold = (gold: number): string => `${(gold / 1000).toFixed(1)}k`
