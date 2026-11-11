import type { ChampionClass, RankTier, Role } from '../../data/types'

/**
 * All scoring numbers in one place so they are easy to tweak.
 * Every score is on a 0–100 scale.
 */

export const ROLE_FIT_SCORE = {
  /** The champion normally plays this role. */
  onRole: 100,
  /** Off-role, but the champion's class suits the role (e.g. a tank in top lane). */
  classFit: 35,
  /** Off-role and the class doesn't suit it either. */
  offRole: 0,
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

/**
 * Team balance only takes points away: team score = average champion score minus these
 * penalties, capped at `MAX_BALANCE_PENALTY`.
 */
export const BALANCE_PENALTIES = {
  /** All five champions deal the same damage type. */
  oneDamageType: 20,
  /** Only one champion deals the other damage type (4–1). */
  lopsidedDamage: 5,
  /** Nobody can stand in front. */
  noFrontline: 20,
  /** At least `MAX_FRONTLINE` frontliners, so not enough damage behind them. */
  tooManyFrontline: 10,
  /** No champion whose main class is marksman, mage or assassin. */
  noCarry: 15,
  /** The ADC slot doesn't hold a marksman. */
  noMarksmanBot: 10,
  /** Five melee champions. */
  allMelee: 10,
  /** Fewer than `MIN_DAMAGE_ITEMS` items with offensive stats. */
  fewDamageItems: 15,
} as const

export const MAX_BALANCE_PENALTY = 45
export const MIN_DAMAGE_ITEMS = 3
export const MAX_FRONTLINE = 4

/** Classes that count as a frontline on their own. */
export const FRONTLINE_CLASSES: readonly ChampionClass[] = ['Tank']
/** Classes that count as a frontline if they hold at least one tank item. */
export const BRUISER_CLASSES: readonly ChampionClass[] = ['Fighter']
/** A champion is a carry when their main (first) class is one of these. */
export const CARRY_CLASSES: readonly ChampionClass[] = ['Marksman', 'Mage', 'Assassin']

/**
 * Ranked tiers from best to worst, with the minimum team score for each.
 * Calibrated with simulate.ts: a bot that always picks the best-fitting role and item has a
 * median score around Gold/Platinum and reaches Challenger in well under 1% of games.
 * Tiers with divisions split their score range evenly into IV (lowest) to I (highest).
 */
export const RANK_THRESHOLDS = [
  { tier: 'Challenger', min: 96, hasDivisions: false, summary: 'Pro play material. Somebody call the scouts.' },
  { tier: 'Grandmaster', min: 92, hasDivisions: false, summary: 'One step from the top. The ladder fears you.' },
  { tier: 'Master', min: 88, hasDivisions: false, summary: 'You actually know what you are doing.' },
  { tier: 'Diamond', min: 82, hasDivisions: true, summary: 'Solid team. Your LP is in safe hands.' },
  { tier: 'Emerald', min: 75, hasDivisions: true, summary: 'Decent. Could win, could also int.' },
  { tier: 'Platinum', min: 66, hasDivisions: true, summary: 'Respectable, as long as nobody tilts.' },
  { tier: 'Gold', min: 56, hasDivisions: true, summary: 'Coin flip. Buy wards and hope.' },
  { tier: 'Silver', min: 45, hasDivisions: true, summary: "There's a game plan. Somewhere." },
  { tier: 'Bronze', min: 30, hasDivisions: true, summary: 'Rough. Mute all and pray.' },
  { tier: 'Iron', min: 0, hasDivisions: true, summary: 'This team is a crime. FF at 15.' },
] as const satisfies readonly { tier: RankTier; min: number; hasDivisions: boolean; summary: string }[]

/** Divisions from lowest to highest. */
export const DIVISIONS = ['IV', 'III', 'II', 'I'] as const

export type Division = (typeof DIVISIONS)[number]
