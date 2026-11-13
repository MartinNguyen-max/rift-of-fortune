import { gameData } from '../data'
import { rollChampion } from '../game/draft'
import type { GameState } from '../game/gameState'
import { drawItems } from '../game/items'
import { pickRandom, sample } from '../game/random'
import { OFFER_SIZE } from '../game/rules'

/** The draft used before a match (vs bots and multiplayer): Classic rolls plus rerolls. */
export const nextChampion = (state: GameState) => rollChampion(gameData.champions, state.team)
export const randomItems = () => drawItems(gameData.items)
/** A reroll never lands on a champion already on the team. */
export const rerollChampion = (state: GameState) => rollChampion(gameData.champions, state.team)
/** An item reroll never lands on an item already in the game. */
export const rerollItem = (state: GameState) => {
  const taken = new Set(state.items.map(({ id }) => id))
  return pickRandom(gameData.items.filter(({ id }) => !taken.has(id)))
}

/** Fast pace: five different random champions to place at once. */
export const offerChampions = () => sample(gameData.champions, OFFER_SIZE)
