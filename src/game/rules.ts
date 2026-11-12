/**
 * How a game mode plays the draft and the shop.
 * - Classic and the Daily: no rerolls, 10 items in two rounds of 5 that must all be used.
 * - Match vs Bots: rerolls for placed champions, and three shop rolls where the player keeps any
 *   items they like; the final roll brings exactly enough items to fill the empty slots.
 */
export interface GameRules {
  championRerolls: number
  itemRolls: 'fixed' | 'pick'
}

export const CLASSIC_RULES: GameRules = { championRerolls: 0, itemRolls: 'fixed' }
export const MATCH_RULES: GameRules = { championRerolls: 3, itemRolls: 'pick' }

/** Shop rolls in 'pick' mode, and how many items each roll before the final one offers. */
export const SHOP_ROLLS = 3
export const SHOP_ROLL_SIZE = 5
