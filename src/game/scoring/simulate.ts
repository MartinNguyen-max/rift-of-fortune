import type { Champion, Item, Role } from '../../data/types'
import { rollChampion } from '../draft'
import { drawItems, ITEMS_PER_CHAMPION } from '../items'
import { pickRandom, type RandomFn } from '../random'
import { ROLES } from '../roles'
import { scoreItemFit } from './itemFit'
import { rateTeam } from './rateTeam'
import { scoreRoleFit } from './roleFit'
import type { TeamMember } from './teamBalance'
import { emptyTeam, type Team } from '../team'

/**
 * Plays whole games without the UI, to calibrate the rank thresholds.
 * - `sensible`: puts each champion in the free role that fits best, gives each item to the
 *   champion it fits best. Roughly how a player who knows the game plays.
 * - `random`: places champions and items at random.
 */
export type Strategy = 'sensible' | 'random'

/** Small seeded random generator (mulberry32), so simulations are reproducible. */
export function seededRandom(seed: number): RandomFn {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function bestBy<T>(options: T[], value: (option: T) => number, random: RandomFn): T {
  const best = Math.max(...options.map(value))
  return pickRandom(
    options.filter((option) => value(option) === best),
    random,
  )
}

function draftTeam(champions: readonly Champion[], strategy: Strategy, random: RandomFn): Record<Role, Champion> {
  let team: Team = emptyTeam()
  for (let pick = 0; pick < ROLES.length; pick++) {
    const champion = rollChampion(champions, team, random)
    const free = ROLES.filter((role) => team[role] === null)
    const role =
      strategy === 'sensible'
        ? bestBy(free, (option) => scoreRoleFit(champion, option).score, random)
        : pickRandom(free, random)
    team = { ...team, [role]: champion }
  }
  return team as Record<Role, Champion>
}

function equipItems(team: Record<Role, Champion>, items: Item[], strategy: Strategy, random: RandomFn) {
  const equipped = Object.fromEntries(ROLES.map((role) => [role, [] as Item[]])) as Record<Role, Item[]>
  for (const item of items) {
    const withRoom = ROLES.filter((role) => equipped[role].length < ITEMS_PER_CHAMPION)
    const role =
      strategy === 'sensible'
        ? bestBy(withRoom, (option) => scoreItemFit(team[option], item), random)
        : pickRandom(withRoom, random)
    equipped[role].push(item)
  }
  return equipped
}

export function simulateGame(
  data: { champions: readonly Champion[]; items: readonly Item[] },
  strategy: Strategy,
  random: RandomFn,
): TeamMember[] {
  const team = draftTeam(data.champions, strategy, random)
  const equipped = equipItems(team, drawItems(data.items, random), strategy, random)
  return ROLES.map((role) => ({ role, champion: team[role], items: equipped[role] }))
}

/** Team scores of `games` simulated games, sorted from low to high. */
export function simulateScores(
  data: { champions: readonly Champion[]; items: readonly Item[] },
  strategy: Strategy,
  games: number,
  seed = 1,
): number[] {
  const random = seededRandom(seed)
  return Array.from({ length: games }, () => rateTeam(simulateGame(data, strategy, random)).score).sort(
    (a, b) => a - b,
  )
}

/** The score below which `fraction` of the sorted scores fall. */
export function percentile(sortedScores: readonly number[], fraction: number): number {
  const index = Math.min(sortedScores.length - 1, Math.floor(fraction * sortedScores.length))
  return sortedScores[index] ?? 0
}
