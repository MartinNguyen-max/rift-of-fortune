import type { ChampionClass, Role } from '../../data/types'

/**
 * All scoring numbers in one place so they are easy to tweak.
 * Every score is on a 0–100 scale.
 */

export const ROLE_FIT_SCORE = {
  /** The champion normally plays this role. */
  onRole: 100,
  /** Off-role, but the champion's class suits the role (e.g. a tank in top lane). */
  classFit: 50,
  /** Off-role and the class doesn't suit it either. */
  offRole: 15,
} as const

/** Classes that can get by in a role even when it isn't their usual one. */
export const ROLE_CLASSES: Record<Role, ChampionClass[]> = {
  TOP: ['Fighter', 'Tank'],
  JUNGLE: ['Fighter', 'Assassin', 'Tank'],
  MIDDLE: ['Mage', 'Assassin'],
  BOTTOM: ['Marksman'],
  SUPPORT: ['Support', 'Tank'],
}

/** What an item is good for, derived from its stats. An item can have several tags. */
export type ItemTag = 'AD' | 'AP' | 'CRIT' | 'ATTACK_SPEED' | 'LETHALITY' | 'TANK' | 'ENCHANTER'

export const OFFENSIVE_TAGS: readonly ItemTag[] = ['AD', 'AP', 'CRIT', 'ATTACK_SPEED', 'LETHALITY']

/** How much each class wants raw damage (AD or AP) of its own damage type. */
export const DAMAGE_AFFINITY: Record<ChampionClass, number> = {
  Assassin: 100,
  Mage: 100,
  Fighter: 90,
  Marksman: 85,
  Tank: 35,
  Support: 30,
}

/** AD items on AP champions, or AP items on AD champions. */
export const WRONG_DAMAGE_TYPE_AFFINITY = 10

/** How much each class likes the non-damage-type item tags. */
export const CLASS_TAG_AFFINITY: Record<ChampionClass, Record<Exclude<ItemTag, 'AD' | 'AP'>, number>> = {
  Assassin: { CRIT: 30, ATTACK_SPEED: 20, LETHALITY: 100, TANK: 15, ENCHANTER: 5 },
  Fighter: { CRIT: 25, ATTACK_SPEED: 55, LETHALITY: 60, TANK: 80, ENCHANTER: 5 },
  Mage: { CRIT: 5, ATTACK_SPEED: 25, LETHALITY: 5, TANK: 25, ENCHANTER: 45 },
  Marksman: { CRIT: 100, ATTACK_SPEED: 100, LETHALITY: 45, TANK: 10, ENCHANTER: 5 },
  Support: { CRIT: 5, ATTACK_SPEED: 10, LETHALITY: 5, TANK: 55, ENCHANTER: 100 },
  Tank: { CRIT: 5, ATTACK_SPEED: 15, LETHALITY: 5, TANK: 100, ENCHANTER: 25 },
}

/** Used for an item without any recognised stats. */
export const NEUTRAL_ITEM_FIT = 50

/** Item fit at or above this gets a compliment, at or below `bad` gets roasted. */
export const ITEM_FIT_THRESHOLDS = { good: 75, bad: 30 } as const

export const CHAMPION_SCORE_WEIGHTS = { roleFit: 0.5, itemFit: 0.5 } as const

export const TEAM_SCORE_WEIGHTS = { champions: 0.75, balance: 0.25 } as const

export const BALANCE_PENALTIES = {
  /** All five champions deal the same damage type. */
  oneDamageType: 30,
  /** Nobody can stand in front. */
  noFrontline: 35,
  /** No marksman, mage or assassin. */
  noCarry: 25,
  /** Fewer than `minDamageItems` items with offensive stats. */
  fewDamageItems: 25,
} as const

export const MIN_DAMAGE_ITEMS = 3

/** Classes that count as a frontline on their own. */
export const FRONTLINE_CLASSES: readonly ChampionClass[] = ['Tank']
/** Classes that count as a frontline if they hold at least one tank item. */
export const BRUISER_CLASSES: readonly ChampionClass[] = ['Fighter']
export const CARRY_CLASSES: readonly ChampionClass[] = ['Marksman', 'Mage', 'Assassin']

export const GRADES = [
  { min: 90, grade: 'S', summary: 'Pro play material. Somebody call the scouts.' },
  { min: 80, grade: 'A', summary: 'Solid team. Your LP is in safe hands.' },
  { min: 65, grade: 'B', summary: 'Decent. Could win, could also int.' },
  { min: 50, grade: 'C', summary: 'Coin flip. Buy wards and hope.' },
  { min: 35, grade: 'D', summary: 'Rough. Mute all and pray.' },
  { min: 0, grade: 'F', summary: 'This team is a crime. FF at 15.' },
] as const

export type Grade = (typeof GRADES)[number]['grade']
