import type { Item, Role } from '../data/types'
import { sample, type RandomFn } from './random'

export const ITEM_COUNT = 10
export const ITEMS_PER_CHAMPION = 2

/** Maps item id to the role of the champion holding it. */
export type ItemAssignments = Partial<Record<string, Role>>

export function drawItems(pool: readonly Item[], random?: RandomFn): Item[] {
  return sample(pool, ITEM_COUNT, random)
}

export function itemsForRole(items: readonly Item[], assignments: ItemAssignments, role: Role): Item[] {
  return items.filter((item) => assignments[item.id] === role)
}

export function unassignedItems(items: readonly Item[], assignments: ItemAssignments): Item[] {
  return items.filter((item) => assignments[item.id] === undefined)
}

export function canAssignItem(assignments: ItemAssignments, itemId: string, role: Role): boolean {
  if (assignments[itemId] === role) return false
  const held = Object.values(assignments).filter((assigned) => assigned === role).length
  return held < ITEMS_PER_CHAMPION
}

export function allItemsAssigned(items: readonly Item[], assignments: ItemAssignments): boolean {
  return items.length > 0 && unassignedItems(items, assignments).length === 0
}
