import type { Champion, Item, Role } from '../../data/types'
import { completeTeam } from './completeTeam'
import { isRole, ROLES } from '../roles'
import type { TeamMember } from '../scoring/teamBalance'
import { ITEMS_PER_CHAMPION } from '../items'

/** A team as sent to the other player: just ids, so the message stays small. */
export interface EncodedMember {
  role: Role
  champion: string
  items: string[]
}

export type EncodedTeam = EncodedMember[]

interface GameDataPools {
  champions: readonly Champion[]
  items: readonly Item[]
}

export function encodeTeam(members: readonly TeamMember[]): EncodedTeam {
  return members.map(({ role, champion, items }) => ({ role, champion: champion.id, items: items.map(({ id }) => id) }))
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')

function isEncodedMember(value: unknown): value is EncodedMember {
  if (typeof value !== 'object' || value === null) return false
  const member = value as Record<string, unknown>
  return isRole(member.role) && typeof member.champion === 'string' && isStringArray(member.items)
}

export function isEncodedTeam(value: unknown): value is EncodedTeam {
  return Array.isArray(value) && value.every(isEncodedMember)
}

/**
 * Looks the ids up again. Returns null for anything that isn't a full team: one champion per role,
 * two known items each. Both players use the same patch data, so ids always match.
 */
export function decodeTeam(team: EncodedTeam, data: GameDataPools): TeamMember[] | null {
  const members = ROLES.map((role) => {
    const entry = team.find((member) => member.role === role)
    const champion = data.champions.find(({ id }) => id === entry?.champion)
    const items = (entry?.items ?? []).flatMap((itemId) => data.items.filter(({ id }) => id === itemId))
    return champion && items.length === ITEMS_PER_CHAMPION ? { role, champion, items } : null
  })
  return members.every((member) => member !== null) && team.length === ROLES.length ? members : null
}

/** A whole random team, for a player who never sent theirs (they left during the draft). */
export function randomEncodedTeam(data: GameDataPools, random: () => number): EncodedTeam {
  return encodeTeam(completeTeam(null, data, random))
}
