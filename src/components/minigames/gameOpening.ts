import { championLoadingUrl } from '../../data'
import type { MiniGameId } from '../../game/minigames/catalog'
import { SKINS } from './miniGameArt'

/** Skins in the opening art, yours then the opponent's. Skin 0 (the base skin) when not listed. */
const OPENING_SKINS: Partial<Record<MiniGameId, readonly [number, number]>> = {
  duel: [SKINS.sheriffCaitlyn, SKINS.highNoonJhin],
  cleaver: [0, SKINS.elMachoMundo],
}

export interface OpeningArt {
  you: string
  them: string
  /** The same picture on both sides: the opponent's is flipped so they face each other. */
  mirror: boolean
}

/** The loading-screen art of both champions for a mini-game's opening. */
export function openingArt(game: MiniGameId, champion: string, opponentChampion: string): OpeningArt {
  const [yourSkin, theirSkin] = OPENING_SKINS[game] ?? [0, 0]
  return {
    you: championLoadingUrl(champion, yourSkin),
    them: championLoadingUrl(opponentChampion, theirSkin),
    mirror: champion === opponentChampion && yourSkin === theirSkin,
  }
}
