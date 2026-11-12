import type { ChampionClass, RankTier, Role } from '../../data/types'

/**
 * All scoring numbers in one place so they are easy to tweak.
 * Every score is on a 0–100 scale.
 */

export const ROLE_FIT_SCORE = {
  /** The champion's most played role. */
  mainRole: 100,
  /** Another role the champion is regularly played in. */
  secondaryRole: 85,
  /** An off-role pick that really shows up in ranked (offMeta.ts), e.g. Briar in bot lane. */
  offMeta: 60,
  /** Minimum when off-role but the champion's class suits the role (e.g. a tank in top lane). */
  classFit: 35,
} as const

/**
 * How well a champion from one role (rows) does in another (columns), based on how League plays:
 * mid laners in top are fairly normal, a support in the jungle is a disaster.
 * The diagonal is never used (that's the champion's own role).
 */
export const LANE_SWAP_SCORE: Record<Role, Record<Role, number>> = {
  TOP: { TOP: 100, JUNGLE: 45, MIDDLE: 55, BOTTOM: 15, SUPPORT: 35 },
  JUNGLE: { TOP: 50, JUNGLE: 100, MIDDLE: 45, BOTTOM: 10, SUPPORT: 30 },
  MIDDLE: { TOP: 50, JUNGLE: 35, MIDDLE: 100, BOTTOM: 40, SUPPORT: 40 },
  BOTTOM: { TOP: 20, JUNGLE: 10, MIDDLE: 50, BOTTOM: 100, SUPPORT: 35 },
  SUPPORT: { TOP: 20, JUNGLE: 5, MIDDLE: 35, BOTTOM: 30, SUPPORT: 100 },
}

/** Off-role scores at or above `closeFit` are a reasonable swap, below `stretch` a disaster. */
export const ROLE_FIT_BANDS = { closeFit: 45, stretch: 20 } as const

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

/**
 * Item fit from the build table (builds.ts): an item the champion's main build profile buys, one
 * their second profile buys, and the most any other item can score (it falls back to the stat fit).
 */
export const ITEM_BUILD_FIT = { main: 100, second: 85, offBuildCap: 45 } as const

/** A champion's item score leans this much toward their worst item, so one troll item hurts. */
export const WORST_ITEM_WEIGHT = 0.5

/** Used for an item without any recognised stats. */
export const NEUTRAL_ITEM_FIT = 50

/** Item fit at or above this gets a compliment, at or below `bad` gets roasted. */
export const ITEM_FIT_THRESHOLDS = { good: 75, bad: 35 } as const

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
 * Calibrated with simulate.ts (see simulate.test.ts): a bot that always picks the best-fitting role and item
 * has a median around Platinum, reaches Diamond+ in about 14% of games and Challenger in about 1%.
 * Tiers with divisions split their score range evenly into IV (lowest) to I (highest).
 */
export const RANK_THRESHOLDS = [
  { tier: 'Challenger', min: 88, hasDivisions: false, summary: 'Pro play material. Somebody call the scouts.' },
  { tier: 'Grandmaster', min: 85, hasDivisions: false, summary: 'One step from the top. The ladder fears you.' },
  { tier: 'Master', min: 82, hasDivisions: false, summary: 'You actually know what you are doing.' },
  { tier: 'Diamond', min: 77, hasDivisions: true, summary: 'Solid team. Your LP is in safe hands.' },
  { tier: 'Emerald', min: 67, hasDivisions: true, summary: 'Decent. Could win, could also int.' },
  { tier: 'Platinum', min: 58, hasDivisions: true, summary: 'Respectable, as long as nobody tilts.' },
  { tier: 'Gold', min: 50, hasDivisions: true, summary: 'Coin flip. Buy wards and hope.' },
  { tier: 'Silver', min: 42, hasDivisions: true, summary: "There's a game plan. Somewhere." },
  { tier: 'Bronze', min: 28, hasDivisions: true, summary: 'Rough. Mute all and pray.' },
  { tier: 'Iron', min: 0, hasDivisions: true, summary: 'This team is a crime. FF at 15.' },
] as const satisfies readonly { tier: RankTier; min: number; hasDivisions: boolean; summary: string }[]

/** Divisions from lowest to highest. */
export const DIVISIONS = ['IV', 'III', 'II', 'I'] as const

export type Division = (typeof DIVISIONS)[number]
