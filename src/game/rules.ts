/**
 * How a game mode plays the draft and the shop.
 * - The Daily: no rerolls (everyone plays the same team).
 * - Classic: once all five champions are placed, up to `championRerolls` of them can be swapped
 *   for a random new one; once all ten items are equipped, up to `itemRerolls` items can be swapped.
 */
export interface GameRules {
  championRerolls: number
  itemRerolls: number
}

export const DAILY_RULES: GameRules = { championRerolls: 0, itemRerolls: 0 }
export const CLASSIC_RULES: GameRules = { championRerolls: 3, itemRerolls: 3 }
