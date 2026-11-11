import { ROLES, type Role } from '../data/types'

export { ROLES }

export const ROLE_LABELS: Record<Role, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'ADC',
  SUPPORT: 'Support',
}

/** Slot positions on the Summoner's Rift minimap, in percent of its width/height. */
export const ROLE_MAP_POSITIONS: Record<Role, { x: number; y: number }> = {
  TOP: { x: 14, y: 16 },
  JUNGLE: { x: 30, y: 58 },
  MIDDLE: { x: 50, y: 50 },
  BOTTOM: { x: 76, y: 87 },
  SUPPORT: { x: 89, y: 74 },
}
