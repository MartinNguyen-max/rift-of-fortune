import type { Champion } from '../data/types'
import { pickRandom, type RandomFn } from './random'
import { ROLES } from './roles'
import type { Team } from './team'

/** Rolls a random champion that is not already on the team. */
export function rollChampion(pool: readonly Champion[], team: Team, random?: RandomFn): Champion {
  const taken = new Set(ROLES.map((role) => team[role]?.id))
  return pickRandom(
    pool.filter((champion) => !taken.has(champion.id)),
    random,
  )
}
