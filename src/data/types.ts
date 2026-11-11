export const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'] as const
export type Role = (typeof ROLES)[number]

export const CHAMPION_CLASSES = ['Assassin', 'Fighter', 'Mage', 'Marksman', 'Support', 'Tank'] as const
export type ChampionClass = (typeof CHAMPION_CLASSES)[number]

export type DamageType = 'AD' | 'AP'
export type AttackType = 'MELEE' | 'RANGED'

export interface Champion {
  id: string
  name: string
  title: string
  image: string
  classes: ChampionClass[]
  positions: Role[]
  damageType: DamageType
  attackType: AttackType
}

export const STAT_KEYS = [
  'abilityPower',
  'abilityHaste',
  'moveSpeed',
  'manaRegen',
  'attackDamage',
  'health',
  'armor',
  'mana',
  'magicResist',
  'healthRegen',
  'attackSpeed',
  'critChance',
  'critDamage',
  'omnivamp',
  'tenacity',
  'lethality',
  'healAndShieldPower',
  'armorPenetration',
  'lifeSteal',
  'magicPenetration',
] as const
export type StatKey = (typeof STAT_KEYS)[number]
export type ItemStats = Partial<Record<StatKey, number>>

export interface Item {
  id: string
  name: string
  image: string
  gold: number
  stats: ItemStats
}

export interface GameData {
  patch: string
  champions: Champion[]
  items: Item[]
}
