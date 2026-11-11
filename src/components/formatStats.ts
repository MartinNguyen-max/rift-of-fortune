import type { ItemStats, StatKey } from '../data/types'

/** Display order and labels for item stats. */
const STAT_DISPLAY: readonly { key: StatKey; label: string; percent: boolean }[] = [
  { key: 'attackDamage', label: 'AD', percent: false },
  { key: 'abilityPower', label: 'AP', percent: false },
  { key: 'attackSpeed', label: 'Attack Speed', percent: true },
  { key: 'critChance', label: 'Crit', percent: true },
  { key: 'critDamage', label: 'Crit Damage', percent: true },
  { key: 'lethality', label: 'Lethality', percent: false },
  { key: 'armorPenetration', label: 'Armor Pen', percent: true },
  { key: 'magicPenetration', label: 'Magic Pen', percent: false },
  { key: 'lifeSteal', label: 'Life Steal', percent: true },
  { key: 'omnivamp', label: 'Omnivamp', percent: true },
  { key: 'health', label: 'Health', percent: false },
  { key: 'armor', label: 'Armor', percent: false },
  { key: 'magicResist', label: 'MR', percent: false },
  { key: 'abilityHaste', label: 'Haste', percent: false },
  { key: 'mana', label: 'Mana', percent: false },
  { key: 'manaRegen', label: 'Mana Regen', percent: true },
  { key: 'healthRegen', label: 'HP Regen', percent: true },
  { key: 'healAndShieldPower', label: 'Heal & Shield', percent: true },
  { key: 'moveSpeed', label: 'Move Speed', percent: true },
  { key: 'tenacity', label: 'Tenacity', percent: true },
]

export function formatStats(stats: ItemStats): string[] {
  return STAT_DISPLAY.flatMap(({ key, label, percent }) => {
    const value = stats[key]
    return value === undefined ? [] : [`${value}${percent ? '%' : ''} ${label}`]
  })
}
