/**
 * How a game mode plays the draft and the shop.
 * - Classic and the Daily: no rerolls.
 * - Match vs Bots: once all five champions are placed, up to `championRerolls` of them can be swapped
 *   for a random new one; once all ten items are equipped, up to `itemRerolls` items can be swapped.
 */
export interface GameRules {
  championRerolls: number
  itemRerolls: number
}

export const CLASSIC_RULES: GameRules = { championRerolls: 0, itemRerolls: 0 }
export const MATCH_RULES: GameRules = { championRerolls: 3, itemRerolls: 3 }
