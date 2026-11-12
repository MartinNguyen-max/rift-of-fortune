import type { Champion, Item } from '../data/types'

export function makeChampion(overrides: Partial<Champion> = {}): Champion {
  return {
    id: 'Test',
    key: '0',
    name: overrides.id ?? 'Test',
    title: '',
    image: '',
    classes: ['Fighter'],
    positions: ['TOP'],
    damageType: 'AD',
    attackType: 'MELEE',
    ...overrides,
  }
}

export function makeItem(overrides: Partial<Item> = {}): Item {
  return { id: '1', name: overrides.id ?? 'Item', image: '', gold: 3000, stats: {}, from: [], ...overrides }
}
