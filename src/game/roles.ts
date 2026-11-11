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
  JUNGLE: { x: 25, y: 62 },
  MIDDLE: { x: 50, y: 50 },
  BOTTOM: { x: 73, y: 87 },
  SUPPORT: { x: 87, y: 72 },
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}
