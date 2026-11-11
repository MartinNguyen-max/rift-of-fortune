import type { Champion, Role } from '../data/types'
import { ROLES } from './roles'

export type Team = Record<Role, Champion | null>

export function emptyTeam(): Team {
  return { TOP: null, JUNGLE: null, MIDDLE: null, BOTTOM: null, SUPPORT: null }
}

export function emptyRoles(team: Team): Role[] {
  return ROLES.filter((role) => team[role] === null)
}

export function isTeamComplete(team: Team): boolean {
  return emptyRoles(team).length === 0
}
