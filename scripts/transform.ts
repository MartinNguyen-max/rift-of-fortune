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
  /** Numeric champion id, used as the key in Meraki's championrates.json. */
  key: string
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

/** Meraki Analytics' championrates.json entry: play rate per role. UTILITY is support. */
export type MerakiRoleRates = Record<string, { playRate: number }>

const RATE_ROLES: Record<string, Role> = {
  TOP: 'TOP',
  JUNGLE: 'JUNGLE',
  MIDDLE: 'MIDDLE',
  BOTTOM: 'BOTTOM',
  UTILITY: 'SUPPORT',
}

/**
 * Meraki's positions list every role a champion has ever been played in (e.g. Taric mid).
 * Keeps only the roles that also have a play rate, most played first, so the first role is the
 * champion's main role. Falls back to all positions when the rates are missing or rule out everything.
 */
export function filterByPlayRate(positions: Role[], rates: MerakiRoleRates | undefined): Role[] {
  if (!rates) return positions
  const rateOf = new Map<Role | undefined, number>(
    Object.entries(rates).map(([rateRole, { playRate }]) => [RATE_ROLES[rateRole], playRate]),
  )
  const kept = positions
    .filter((position) => (rateOf.get(position) ?? 0) > 0)
    .sort((a, b) => (rateOf.get(b) ?? 0) - (rateOf.get(a) ?? 0))
  return kept.length > 0 ? kept : positions
}

const WIKI_ROLES: Record<string, Role> = {
  Top: 'TOP',
  Jungle: 'JUNGLE',
  Middle: 'MIDDLE',
  Bottom: 'BOTTOM',
  Support: 'SUPPORT',
}

/**
 * Reads the roles each champion is played in from the League of Legends Wiki's champion data
 * module (a Lua table): the roles Riot's client recommends (`client_positions`) and the roles
 * stats sites show (`external_positions`). Keyed by Data Dragon id (`apiname`).
 */
export function parseWikiPositions(lua: string): Record<string, Role[]> {
  const positions: Record<string, Role[]> = {}
  const list = (block: string, key: string): Role[] => {
    const match = block.match(new RegExp(String.raw`\["${key}"\]\s*=\s*\{([^}]*)\}`))
    return [...(match?.[1] ?? '').matchAll(/"(\w+)"/g)].flatMap(([, name]) => {
      const role = name ? WIKI_ROLES[name] : undefined
      return role ? [role] : []
    })
  }
  for (const block of lua.split(/\n {2}\["/).slice(1)) {
    const id = block.match(/\["apiname"\]\s*=\s*"([^"]+)"/)?.[1]
    if (id) positions[id] = [...new Set([...list(block, 'client_positions'), ...list(block, 'external_positions')])]
  }
  return positions
}

/** Adds the wiki's roles after the play-rate roles, so the main role stays first. */
export function addWikiPositions(positions: Role[], wiki: Role[] | undefined): Role[] {
  return [...positions, ...(wiki ?? []).filter((role) => !positions.includes(role))]
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

export function toChampion(
  champion: DDragonChampion,
  meraki: MerakiChampion | undefined,
  rates?: MerakiRoleRates,
  wikiPositions?: Role[],
): Champion {
  const classes = champion.tags.filter(isChampionClass)
  const fallbackDamage: DamageType = champion.info.magic > champion.info.attack ? 'AP' : 'AD'
  const fallbackAttack: AttackType = champion.stats.attackrange > 300 ? 'RANGED' : 'MELEE'
  const positions = filterByPlayRate(meraki?.positions.filter(isRole) ?? [], rates)

  return {
    id: champion.id,
    name: champion.name,
    title: champion.title,
    image: champion.image.full,
    classes,
    positions: addWikiPositions(
      positions.length > 0 ? positions : wikiPositions?.length ? wikiPositions : guessPositions(classes, champion.stats.attackrange),
      wikiPositions,
    ),
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
