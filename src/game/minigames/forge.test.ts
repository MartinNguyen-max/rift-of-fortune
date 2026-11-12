import { describe, expect, it } from 'vitest'
import { gameData } from '../../data'
import type { ItemComponent } from '../../data/types'
import { makeItem } from '../testUtils'
import {
  addPart,
  botForgeTimes,
  botItemsDone,
  FORGE_ITEM_COUNT,
  forgeableItems,
  forgeOrders,
  missingParts,
  POPULAR_ITEMS,
  TRAY_SIZE,
} from './forge'

const part = (id: string): ItemComponent => ({ id, name: id, image: '', gold: 500 })
const components = ['rod', 'sword', 'bow', 'belt', 'tome', 'vest', 'cloak', 'dagger', 'gem', 'pick'].map(part)
const items = [
  makeItem({ id: '1', name: "Rabadon's Deathcap", from: ['rod', 'rod'] }),
  makeItem({ id: '2', name: 'Infinity Edge', from: ['sword', 'pick', 'cloak'] }),
  makeItem({ id: '3', name: 'Trinity Force', from: ['dagger', 'gem', 'sword'] }),
  makeItem({ id: '4', name: 'Unknown Item', from: ['bow', 'tome'] }),
]

describe('forgeableItems', () => {
  it('prefers popular items', () => {
    expect(forgeableItems(items, components).map((item) => item.id)).toEqual(['1', '2', '3'])
  })

  it('finds enough popular items in the real data', () => {
    const popular = forgeableItems(gameData.items, gameData.components).filter((item) =>
      (POPULAR_ITEMS as readonly string[]).includes(item.name),
    )
    expect(popular.length).toBeGreaterThanOrEqual(30)
  })
})

describe('forgeOrders', () => {
  it('builds 3 different items with every recipe part on a tray of 8', () => {
    for (let seed = 0; seed < 30; seed++) {
      const orders = forgeOrders(seed, gameData.items, gameData.components)
      expect(orders).toHaveLength(FORGE_ITEM_COUNT)
      expect(new Set(orders.map((order) => order.item.id)).size).toBe(FORGE_ITEM_COUNT)
      for (const order of orders) {
        expect(order.tray).toHaveLength(TRAY_SIZE)
        expect(new Set(order.tray.map((p) => p.id)).size).toBe(TRAY_SIZE)
        for (const needed of order.recipe) expect(order.tray.map((p) => p.id)).toContain(needed.id)
      }
    }
  })

  it('is the same for the same seed', () => {
    expect(forgeOrders(4, items, components)).toEqual(forgeOrders(4, items, components))
  })
})

describe('addPart', () => {
  const deathcap = forgeOrders(1, items.slice(0, 1), components)[0]
  if (!deathcap) throw new Error('No order')

  it('needs the same part twice when the recipe has it twice', () => {
    expect(addPart(deathcap, [], 'rod')).toBe('added')
    expect(addPart(deathcap, ['rod'], 'rod')).toBe('complete')
    expect(missingParts(deathcap, ['rod']).map((p) => p.id)).toEqual(['rod'])
  })

  it('rejects parts the item is not built from', () => {
    expect(addPart(deathcap, [], 'sword')).toBe('wrong')
  })
})

describe('botForgeTimes', () => {
  it('finishes the items one after another in a fair time', () => {
    const orders = forgeOrders(2, gameData.items, gameData.components)
    const times = botForgeTimes(2, orders)
    expect(times).toHaveLength(FORGE_ITEM_COUNT)
    const [first = 0, second = 0, last = 0] = times
    expect(first).toBeLessThan(second)
    expect(second).toBeLessThan(last)
    expect(last).toBeGreaterThan(8)
    expect(last).toBeLessThan(35)
    expect(botItemsDone(times, 0)).toBe(0)
    expect(botItemsDone(times, last)).toBe(3)
  })
})
