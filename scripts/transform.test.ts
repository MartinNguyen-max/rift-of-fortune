import { describe, expect, it } from 'vitest'
import {
  dedupeByName,
  filterByPlayRate,
  guessPositions,
  isFullItem,
  parseItemStats,
  toChampion,
  type DDragonChampion,
  type DDragonItem,
} from './transform.ts'

const baseItem: DDragonItem = {
  name: 'Infinity Edge',
  description:
    '<mainText><stats><attention>75</attention> Attack Damage<br><attention>25%</attention> Critical Strike Chance</stats></mainText>',
  image: { full: '3031.png' },
  gold: { total: 3500, purchasable: true },
  tags: ['CriticalStrike', 'Damage'],
  maps: { '11': true },
  from: ['1038', '1037'],
}

describe('parseItemStats', () => {
  it('reads flat and percentage stats from the description', () => {
    expect(parseItemStats(baseItem.description)).toEqual({ attackDamage: 75, critChance: 25 })
  })

  it('returns no stats when the description has no stats block', () => {
    expect(parseItemStats('<mainText>Nothing</mainText>')).toEqual({})
  })

  it('ignores unknown stat labels', () => {
    expect(parseItemStats('<stats><attention>5</attention> Mystery Power</stats>')).toEqual({})
  })
})

describe('isFullItem', () => {
  it('accepts a completed Summoner’s Rift item', () => {
    expect(isFullItem('3031', baseItem)).toBe(true)
  })

  it.each<[string, string, Partial<DDragonItem>]>([
    ['components', '1038', { from: [], into: ['3031'] }],
    ['items that build into something', '3031', { into: ['9999'] }],
    ['boots', '3006', { tags: ['Boots'] }],
    ['cheap items', '3041', { gold: { total: 1500, purchasable: true } }],
    ['other modes', '323003', {}],
    ['items not on Summoner’s Rift', '3031', { maps: { '11': false } }],
    ['champion-only items', '3031', { requiredChampion: 'Gangplank' }],
    ['Ornn upgrades', '3031', { requiredAlly: 'Ornn' }],
  ])('rejects %s', (_, id, override) => {
    expect(isFullItem(id, { ...baseItem, ...override })).toBe(false)
  })
})

describe('toChampion', () => {
  const ddragon: DDragonChampion = {
    id: 'Ahri',
    key: '103',
    name: 'Ahri',
    title: 'the Nine-Tailed Fox',
    tags: ['Mage', 'Assassin'],
    info: { attack: 3, defense: 4, magic: 8, difficulty: 5 },
    image: { full: 'Ahri.png' },
    stats: { attackrange: 550 },
  }

  it('uses Meraki positions and damage type when available', () => {
    const champion = toChampion(ddragon, {
      positions: ['MIDDLE'],
      attackType: 'RANGED',
      adaptiveType: 'MAGIC_DAMAGE',
    })
    expect(champion).toMatchObject({
      classes: ['Mage', 'Assassin'],
      positions: ['MIDDLE'],
      damageType: 'AP',
      attackType: 'RANGED',
    })
  })

  it('falls back to Data Dragon info when Meraki has no entry', () => {
    const champion = toChampion(ddragon, undefined)
    expect(champion).toMatchObject({ positions: ['MIDDLE'], damageType: 'AP', attackType: 'RANGED' })
  })
})

const ddragonForRates: DDragonChampion = {
  id: 'Taric',
  key: '44',
  name: 'Taric',
  title: 'the Shield of Valoran',
  tags: ['Support'],
  info: { attack: 4, defense: 8, magic: 5, difficulty: 3 },
  image: { full: 'Taric.png' },
  stats: { attackrange: 150 },
}

describe('filterByPlayRate', () => {
  const rates = {
    TOP: { playRate: 0 },
    JUNGLE: { playRate: 0 },
    MIDDLE: { playRate: 0 },
    BOTTOM: { playRate: 0 },
    UTILITY: { playRate: 4.2 },
  }

  it('drops roles nobody actually plays (Taric mid)', () => {
    expect(filterByPlayRate(['MIDDLE', 'SUPPORT'], rates)).toEqual(['SUPPORT'])
  })

  it('keeps all positions when there are no rates', () => {
    expect(filterByPlayRate(['MIDDLE', 'SUPPORT'], undefined)).toEqual(['MIDDLE', 'SUPPORT'])
  })

  it('keeps all positions when the rates rule out every one of them', () => {
    expect(filterByPlayRate(['TOP'], rates)).toEqual(['TOP'])
  })

  it('puts the most played role first', () => {
    const malphite = { ...rates, TOP: { playRate: 3 }, UTILITY: { playRate: 1 }, MIDDLE: { playRate: 0.5 } }
    expect(filterByPlayRate(['MIDDLE', 'SUPPORT', 'TOP'], malphite)).toEqual(['TOP', 'SUPPORT', 'MIDDLE'])
  })

  it('is used by toChampion', () => {
    const champion = toChampion(
      { ...ddragonForRates, tags: ['Support'] },
      { positions: ['MIDDLE', 'SUPPORT'], attackType: 'MELEE', adaptiveType: 'MAGIC_DAMAGE' },
      rates,
    )
    expect(champion.positions).toEqual(['SUPPORT'])
  })
})

describe('guessPositions', () => {
  it('puts marksmen in the bot lane', () => {
    expect(guessPositions(['Marksman'], 550)).toEqual(['BOTTOM'])
  })

  it('treats fighters as top or jungle', () => {
    expect(guessPositions(['Fighter'], 175)).toEqual(['TOP', 'JUNGLE'])
  })
})

describe('dedupeByName', () => {
  it('keeps the lowest id per name and sorts by name', () => {
    const item = { image: '', gold: 0, stats: {} }
    const result = dedupeByName([
      { ...item, id: '3050', name: 'Zeke' },
      { ...item, id: '323003', name: 'Archangel' },
      { ...item, id: '3003', name: 'Archangel' },
    ])
    expect(result.map((i) => i.id)).toEqual(['3003', '3050'])
  })
})
