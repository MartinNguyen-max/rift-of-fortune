import type {
  AttackType,
  Champion,
  ChampionClass,
  DamageType,
  Item,
  ItemStats,
  Role,
  StatKey,
} from '../src/data/types.ts'
import { CHAMPION_CLASSES, ROLES } from '../src/data/types.ts'

/** Subset of Data Dragon's champion.json entry that we use. */
export interface DDragonChampion {
  id: string
  name: string
  title: string
  tags: string[]
  info: { attack: number; defense: number; magic: number; difficulty: number }
  image: { full: string }
  stats: { attackrange: number }
}

/** Subset of Data Dragon's item.json entry that we use. */
export interface DDragonItem {
  name: string
  description: string
  image: { full: string }
  gold: { total: number; purchasable: boolean }
  tags: string[]
  maps: Record<string, boolean>
  from?: string[]
  into?: string[]
  inStore?: boolean
  hideFromAll?: boolean
  requiredChampion?: string
  requiredAlly?: string
}

/** Subset of Meraki Analytics' champions.json entry that we use. */
export interface MerakiChampion {
  positions: string[]
  attackType: string
  adaptiveType: string
}

const SUMMONERS_RIFT_MAP_ID = '11'
const MIN_FULL_ITEM_GOLD = 2000
/** Ids at or above this are copies of items for other modes (Arena, Swiftplay, ...). */
const MAX_CLASSIC_ITEM_ID = 10000

const STAT_LABELS: Record<string, StatKey> = {
  'Ability Power': 'abilityPower',
  'Ability Haste': 'abilityHaste',
  'Move Speed': 'moveSpeed',
  'Base Mana Regen': 'manaRegen',
  'Attack Damage': 'attackDamage',
  Health: 'health',
  Armor: 'armor',
  Mana: 'mana',
  'Magic Resist': 'magicResist',
  'Base Health Regen': 'healthRegen',
  'Attack Speed': 'attackSpeed',
  'Critical Strike Chance': 'critChance',
  'Critical Strike Damage': 'critDamage',
  Omnivamp: 'omnivamp',
  Tenacity: 'tenacity',
  Lethality: 'lethality',
  'Heal and Shield Power': 'healAndShieldPower',
  'Armor Penetration': 'armorPenetration',
  'Life Steal': 'lifeSteal',
  'Magic Penetration': 'magicPenetration',
}

export function isFullItem(id: string, item: DDragonItem): boolean {
  return (
    Number(id) < MAX_CLASSIC_ITEM_ID &&
    item.maps[SUMMONERS_RIFT_MAP_ID] === true &&
    item.gold.purchasable &&
    item.gold.total >= MIN_FULL_ITEM_GOLD &&
    (item.from?.length ?? 0) > 0 &&
    (item.into?.length ?? 0) === 0 &&
    !item.tags.includes('Boots') &&
    !item.tags.includes('Consumable') &&
    item.inStore !== false &&
    item.hideFromAll !== true &&
    item.requiredChampion === undefined &&
    item.requiredAlly === undefined
  )
}

/**
 * Data Dragon's `stats` object misses several stats (e.g. Ability Haste),
 * so we parse the `<stats>` block of the item description instead.
 */
export function parseItemStats(description: string): ItemStats {
  const block = /<stats>(.*?)<\/stats>/s.exec(description)?.[1]
  if (!block) return {}

  const stats: ItemStats = {}
  for (const line of block.split(/<br\s*\/?>/)) {
    const text = line.replace(/<[^>]+>/g, '').trim()
    const match = /^([\d.]+)%?\s+(.+)$/.exec(text)
    if (!match?.[1] || !match[2]) continue
    const key = STAT_LABELS[match[2]]
    if (key) stats[key] = (stats[key] ?? 0) + Number(match[1])
  }
  return stats
}

export function toItem(id: string, item: DDragonItem): Item {
  return {
    id,
    name: item.name,
    image: item.image.full,
    gold: item.gold.total,
    stats: parseItemStats(item.description),
  }
}

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value)
}

function isChampionClass(value: string): value is ChampionClass {
  return (CHAMPION_CLASSES as readonly string[]).includes(value)
}

/** Best guess for brand-new champions that Meraki doesn't know yet. */
export function guessPositions(classes: ChampionClass[], attackRange: number): Role[] {
  const primary = classes[0]
  switch (primary) {
    case 'Marksman':
      return ['BOTTOM']
    case 'Support':
      return ['SUPPORT']
    case 'Mage':
      return attackRange > 300 ? ['MIDDLE'] : ['MIDDLE', 'TOP']
    case 'Assassin':
      return ['MIDDLE', 'JUNGLE']
    case 'Tank':
      return ['TOP', 'SUPPORT']
    default:
      return ['TOP', 'JUNGLE']
  }
}

export function toChampion(champion: DDragonChampion, meraki: MerakiChampion | undefined): Champion {
  const classes = champion.tags.filter(isChampionClass)
  const fallbackDamage: DamageType = champion.info.magic > champion.info.attack ? 'AP' : 'AD'
  const fallbackAttack: AttackType = champion.stats.attackrange > 300 ? 'RANGED' : 'MELEE'
  const positions = meraki?.positions.filter(isRole) ?? []

  return {
    id: champion.id,
    name: champion.name,
    title: champion.title,
    image: champion.image.full,
    classes,
    positions: positions.length > 0 ? positions : guessPositions(classes, champion.stats.attackrange),
    damageType: meraki ? (meraki.adaptiveType === 'MAGIC_DAMAGE' ? 'AP' : 'AD') : fallbackDamage,
    attackType: meraki ? (meraki.attackType === 'RANGED' ? 'RANGED' : 'MELEE') : fallbackAttack,
  }
}

/** Removes duplicate items that share a name, keeping the lowest id. */
export function dedupeByName(items: Item[]): Item[] {
  const byName = new Map<string, Item>()
  for (const item of [...items].sort((a, b) => Number(a.id) - Number(b.id))) {
    if (!byName.has(item.name)) byName.set(item.name, item)
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}
