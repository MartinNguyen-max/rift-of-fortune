import type { Champion, Item, Role } from '../../data/types'
import { rollChampion } from '../draft'
import type { GameState } from '../gameState'
import { canAssignItem, drawItems, type ItemAssignments } from '../items'
import { sample, type RandomFn } from '../random'
import { ROLES } from '../roles'
import type { TeamMember } from '../scoring/teamBalance'
import { emptyRoles, emptyTeam, type Team } from '../team'

interface GameDataPools {
  champions: readonly Champion[]
  items: readonly Item[]
}

/**
 * The draft timer ran out: keeps everything the player already did and fills in the rest at random.
 * The rolled champion goes into a random empty role, empty roles get random champions, and items
 * still in the pool go to random champions with room. `null` drafts a whole random team.
 */
export function completeTeam(state: GameState | null, data: GameDataPools, random: RandomFn): TeamMember[] {
  const team: Team = { ...(state?.team ?? emptyTeam()) }
  const rolled = state?.rolled?.champion
  if (rolled) {
    const [role] = sample(emptyRoles(team), 1, random)
    if (role) team[role] = rolled
  }
  for (const role of emptyRoles(team)) team[role] = rollChampion(data.champions, team, random)

  const items = state && state.items.length > 0 ? state.items : drawItems(data.items, random)
  const assignments: ItemAssignments = { ...(state?.assignments ?? {}) }
  for (const item of items) {
    if (assignments[item.id]) continue
    const [role] = sample(
      ROLES.filter((option) => canAssignItem(assignments, item.id, option)),
      1,
      random,
    )
    if (role) assignments[item.id] = role
  }

  return ROLES.map((role: Role) => {
    const champion = team[role]
    if (!champion) throw new Error(`No champion for ${role}`)
    return { role, champion, items: items.filter(({ id }) => assignments[id] === role) }
  })
}
