import { championLoadingUrl } from '../../data'
import { finisherFor } from '../../game/finishers'
import type { MiniGameId } from '../../game/minigames/catalog'
import { SKINS } from './miniGameArt'

/** The skin of a champion's finisher animation, so the art matches the clip after the game. */
const finisherSkin = (champion: string) => finisherFor(champion)?.skin ?? 0

/** Games with a theme of their own keep their skins (yours, then the opponent's). */
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
  const [yourSkin, theirSkin] = OPENING_SKINS[game] ?? [finisherSkin(champion), finisherSkin(opponentChampion)]
  return {
    you: championLoadingUrl(champion, yourSkin),
    them: championLoadingUrl(opponentChampion, theirSkin),
    mirror: champion === opponentChampion && yourSkin === theirSkin,
  }
}
