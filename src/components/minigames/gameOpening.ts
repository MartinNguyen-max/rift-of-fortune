import { championLoadingUrl } from '../../data'
import { finisherFor } from '../../game/finishers'
import type { MiniGameId } from '../../game/minigames/catalog'
import { SKINS } from './miniGameArt'

/** The skin of a champion's finisher animation, so the art matches the clip after the game. */
const finisherSkin = (champion: string) => finisherFor(champion)?.skin ?? 0

/** Games with a look of their own keep their skins: by champion, or by side in a mirror match. */
const THEMED_SKINS: Partial<Record<MiniGameId, { byChampion?: Readonly<Record<string, number>>; you?: number; opponent?: number }>> = {
  duel: { byChampion: { Caitlyn: SKINS.sheriffCaitlyn, Jhin: SKINS.highNoonJhin } },
  cleaver: { you: SKINS.battleAcademiaKatarina, opponent: SKINS.bloodMoonKatarina },
}

function skinOf(game: MiniGameId, champion: string, opponent: boolean): number {
  const themed = THEMED_SKINS[game]
  if (!themed) return finisherSkin(champion)
  return themed.byChampion?.[champion] ?? (opponent ? themed.opponent : themed.you) ?? 0
}

export interface OpeningArt {
  you: string
  them: string
  /** The same picture on both sides: the opponent's is flipped so they face each other. */
  mirror: boolean
}

/** The loading-screen art of both champions for a mini-game's opening. */
export function openingArt(game: MiniGameId, champion: string, opponentChampion: string): OpeningArt {
  const yourSkin = skinOf(game, champion, false)
  const theirSkin = skinOf(game, opponentChampion, true)
  return {
    you: championLoadingUrl(champion, yourSkin),
    them: championLoadingUrl(opponentChampion, theirSkin),
    mirror: champion === opponentChampion && yourSkin === theirSkin,
  }
}
