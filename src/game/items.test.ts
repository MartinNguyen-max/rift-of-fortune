import { describe, expect, it } from 'vitest'
import {
  allItemsAssigned,
  canAssignItem,
  drawItems,
  ITEM_COUNT,
  itemsForRole,
  unassignedItems,
  type ItemAssignments,
} from './items'
import { makeItem } from './testUtils'

const pool = Array.from({ length: 30 }, (_, i) => makeItem({ id: String(i) }))

describe('drawItems', () => {
  it('draws ten distinct items', () => {
    const items = drawItems(pool)
    expect(items).toHaveLength(ITEM_COUNT)
    expect(new Set(items.map((item) => item.id)).size).toBe(ITEM_COUNT)
  })
})

describe('item assignment', () => {
  const [a, b, c] = pool
  const items = [a, b, c].filter((item) => item !== undefined)
  const assignments: ItemAssignments = { '0': 'TOP', '1': 'TOP' }

  it('allows at most two items per champion', () => {
    expect(canAssignItem(assignments, '2', 'TOP')).toBe(false)
    expect(canAssignItem(assignments, '2', 'MIDDLE')).toBe(true)
  })

  it('lets an item move from one champion to another', () => {
    expect(canAssignItem({ '0': 'TOP' }, '0', 'MIDDLE')).toBe(true)
    expect(canAssignItem({ '0': 'TOP' }, '0', 'TOP')).toBe(false)
  })

  it('lists items per role and unassigned items', () => {
    expect(itemsForRole(items, assignments, 'TOP').map((i) => i.id)).toEqual(['0', '1'])
    expect(unassignedItems(items, assignments).map((i) => i.id)).toEqual(['2'])
  })

  it('knows when every item is assigned', () => {
    expect(allItemsAssigned(items, assignments)).toBe(false)
    expect(allItemsAssigned(items, { ...assignments, '2': 'MIDDLE' })).toBe(true)
  })
})
