import { gameData } from '../../data'
import type { MiniGameId } from './catalog'
import { CLEAVER_RULES } from './cleaver'
import { COMBO_RULES } from './combo'
import { DUEL_RULES } from './duel'
import { EXECUTE_RULES } from './execute'
import { forgeRules } from './forge'
import { GANK_RULES } from './gank'
import { hookRules } from './hook'
import { RACE_RULES } from './race'
import { SHADOW_RULES } from './shadows'
import { SHROOM_RULES } from './shrooms'
import { SMITE_RULES } from './smite'
import { ULT_RULES } from './ult'
import type { MiniGameRules } from './versus'

/** The rules of every mini-game, with the game data they need. Solo and Multiplayer use the same rules. */
export const MINI_GAME_RULES: Record<MiniGameId, MiniGameRules> = {
  duel: DUEL_RULES,
  hook: hookRules(gameData.champions),
  combo: COMBO_RULES,
  shrooms: SHROOM_RULES,
  forge: forgeRules(gameData.items, gameData.components),
  cleaver: CLEAVER_RULES,
  gank: GANK_RULES,
  ult: ULT_RULES,
  execute: EXECUTE_RULES,
  shadows: SHADOW_RULES,
  race: RACE_RULES,
  smite: SMITE_RULES,
}
