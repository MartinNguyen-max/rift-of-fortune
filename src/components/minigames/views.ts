import type { MiniGameId } from '../../game/minigames/catalog'
import { CleaverGame, CleaverTutorialArt } from './CleaverGame'
import { ComboGame, ComboTutorialArt } from './ComboGame'
import { DestinyGame, DestinyTutorialArt } from './DestinyGame'
import { DuelGame, DuelTutorialArt } from './DuelGame'
import { ExecuteGame, ExecuteTutorialArt } from './ExecuteGame'
import { ForgeGame, ForgeTutorialArt } from './ForgeGame'
import { GankGame, GankReveal, GankTutorialArt } from './GankGame'
import { HookGame, HookTutorialArt } from './HookGame'
import { RaceGame, RaceTutorialArt } from './RaceGame'
import { ShadowsGame, ShadowsTutorialArt } from './ShadowsGame'
import { ShroomGame, ShroomTutorialArt } from './ShroomGame'
import { SmiteGame, SmiteReveal, SmiteTutorialArt } from './SmiteGame'
import type { MiniGameView } from './types'
import { UltGame, UltTutorialArt } from './UltGame'
import { WindWallGame, WindWallTutorialArt } from './WindWallGame'

/** The screen, tutorial pictures and (for some) the result picture of every mini-game. */
export const MINI_GAME_VIEWS: Record<MiniGameId, MiniGameView> = {
  duel: { Game: DuelGame, TutorialArt: DuelTutorialArt },
  hook: { Game: HookGame, TutorialArt: HookTutorialArt },
  combo: { Game: ComboGame, TutorialArt: ComboTutorialArt },
  shrooms: { Game: ShroomGame, TutorialArt: ShroomTutorialArt },
  forge: { Game: ForgeGame, TutorialArt: ForgeTutorialArt },
  cleaver: { Game: CleaverGame, TutorialArt: CleaverTutorialArt },
  gank: { Game: GankGame, TutorialArt: GankTutorialArt, Reveal: GankReveal },
  ult: { Game: UltGame, TutorialArt: UltTutorialArt },
  execute: { Game: ExecuteGame, TutorialArt: ExecuteTutorialArt },
  shadows: { Game: ShadowsGame, TutorialArt: ShadowsTutorialArt },
  race: { Game: RaceGame, TutorialArt: RaceTutorialArt },
  windwall: { Game: WindWallGame, TutorialArt: WindWallTutorialArt },
  destiny: { Game: DestinyGame, TutorialArt: DestinyTutorialArt },
  smite: { Game: SmiteGame, TutorialArt: SmiteTutorialArt, Reveal: SmiteReveal },
}
