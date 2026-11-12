import type { MapIcon } from '../../data/types'
import type { DragonKind, MapSpot, MatchEvent, Side } from '../../game/match/types'

/** Blue is the player's team, red the bot. */
export const SIDE_TEXT: Record<Side, string> = { blue: 'text-hextech', red: 'text-red-400' }
export const SIDE_BORDER: Record<Side, string> = { blue: 'border-hextech/60', red: 'border-red-400/60' }
export const SIDE_BG: Record<Side, string> = { blue: 'bg-hextech', red: 'bg-red-400' }

/** A real League minimap icon where one exists, otherwise an emoji. */
export type EventIconSource = { icon: MapIcon } | { emoji: string }

const DRAGON_ICONS: Record<DragonKind, MapIcon> = {
  Infernal: 'infernal',
  Mountain: 'mountain',
  Ocean: 'ocean',
  Cloud: 'cloud',
  Hextech: 'hextech',
  Chemtech: 'chemtech',
}

export function eventIcon({ kind, tags, dragon }: Pick<MatchEvent, 'kind' | 'tags' | 'dragon'>): EventIconSource {
  if (tags.includes('escape')) return { emoji: '💨' }
  switch (kind) {
    case 'soloKill':
      return { emoji: '⚔️' }
    case 'gank':
      return { emoji: '🗡️' }
    case 'teamfight':
      return { emoji: '💥' }
    case 'surrender':
      return { emoji: '🏳️' }
    case 'grubs':
      return { icon: 'grubs' }
    case 'herald':
      return { icon: 'herald' }
    case 'dragon':
      return { icon: dragon ? DRAGON_ICONS[dragon] : 'dragon' }
    case 'elder':
      return { icon: 'elder' }
    case 'baron':
      return { icon: 'baron' }
    case 'tower':
      return { icon: 'tower' }
    case 'inhibitor':
      return { icon: 'inhibitor' }
    case 'nexus':
      return { icon: 'nexus' }
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
