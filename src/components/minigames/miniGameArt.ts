import { championIconUrl, gameData } from '../../data'

/** A champion's square icon by Data Dragon id (falls back to the id itself as the file name). */
export function championIconById(championId: string): string {
  const champion = gameData.champions.find(({ id }) => id === championId)
  return championIconUrl(champion?.image ?? `${championId}.png`)
}

/** Skins used for the mini-games' look. Numbers are Data Dragon skin numbers. */
export const SKINS = {
  sheriffCaitlyn: 2,
  highNoonJhin: 1,
  battleAcademiaKatarina: 12,
  bloodMoonKatarina: 21,
  projectZed: 3,
} as const
