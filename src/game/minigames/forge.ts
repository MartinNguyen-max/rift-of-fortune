import type { Item, ItemComponent } from '../../data/types'
import { sample, seededRandom, type RandomFn } from '../random'

/** Items to build in one game. */
export const FORGE_ITEM_COUNT = 3
/** Parts on the anvil to choose from: the recipe plus decoys. */
export const TRAY_SIZE = 8
/** Seconds added to your time for each wrong part. */
export const WRONG_PART_PENALTY = 2

/** Items most players have bought, so everyone has a fair chance to know the recipe. */
export const POPULAR_ITEMS = [
  'Infinity Edge',
  "Rabadon's Deathcap",
  'Trinity Force',
  'Bloodthirster',
  "Zhonya's Hourglass",
  'Guardian Angel',
  'Black Cleaver',
  'Blade of The Ruined King',
  'Thornmail',
  "Warmog's Armor",
  'Sunfire Aegis',
  "Luden's Echo",
  'Lich Bane',
  "Nashor's Tooth",
  'Morellonomicon',
  'Void Staff',
  "Banshee's Veil",
  'Frozen Heart',
  "Randuin's Omen",
  'Spirit Visage',
  "Sterak's Gage",
  "Death's Dance",
  "Guinsoo's Rageblade",
  'Kraken Slayer',
  'Phantom Dancer',
  'Rapid Firecannon',
  "Runaan's Hurricane",
  "Lord Dominik's Regards",
  "Youmuu's Ghostblade",
  'The Collector',
  "Archangel's Staff",
  'Manamune',
  "Liandry's Torment",
  "Rylai's Crystal Scepter",
  'Shadowflame',
  'Heartsteel',
  'Mercurial Scimitar',
  "Wit's End",
  'Titanic Hydra',
  'Ravenous Hydra',
  'Iceborn Gauntlet',
  "Dead Man's Plate",
  'Hextech Rocketbelt',
  'Edge of Night',
  'Serpent\'s Fang',
] as const

export interface ForgeOrder {
  item: Item
  /** The components to build it, with repeats ("Needlessly Large Rod" twice). */
  recipe: ItemComponent[]
  /** The parts on offer, shuffled: every recipe part once, plus decoys. */
  tray: ItemComponent[]
}

function shuffle<T>(list: readonly T[], random: RandomFn): T[] {
  return sample(list, list.length, random)
}

/** The popular items whose every part is known, falling back to any item when the list misses (new patch). */
export function forgeableItems(items: readonly Item[], components: readonly ItemComponent[]): Item[] {
  const known = new Set(components.map(({ id }) => id))
  const buildable = items.filter((item) => item.from.length >= 2 && item.from.every((id) => known.has(id)))
  const popular = buildable.filter((item) => (POPULAR_ITEMS as readonly string[]).includes(item.name))
  return popular.length >= FORGE_ITEM_COUNT ? popular : buildable
}

/** The orders for one game: FORGE_ITEM_COUNT different items, the same for everyone with this seed. */
export function forgeOrders(seed: number, items: readonly Item[], components: readonly ItemComponent[]): ForgeOrder[] {
  const random = seededRandom(seed)
  const byId = new Map(components.map((component) => [component.id, component]))
  return sample(forgeableItems(items, components), FORGE_ITEM_COUNT, random).map((item) => {
    const recipe = item.from.flatMap((id) => byId.get(id) ?? [])
    const parts = [...new Map(recipe.map((part) => [part.id, part])).values()]
    const decoys = sample(
      components.filter((component) => !item.from.includes(component.id)),
      TRAY_SIZE - parts.length,
      random,
    )
    return { item, recipe, tray: shuffle([...parts, ...decoys], random) }
  })
}

/** The parts still missing from the build, with repeats. */
export function missingParts(order: ForgeOrder, placed: readonly string[]): ItemComponent[] {
  const left = [...placed]
  return order.recipe.filter((part) => {
    const index = left.indexOf(part.id)
    if (index === -1) return true
    left.splice(index, 1)
    return false
  })
}

export type PartResult = 'added' | 'wrong' | 'complete'

/** Puts a part on the anvil: right if the build still needs it. */
export function addPart(order: ForgeOrder, placed: readonly string[], partId: string): PartResult {
  const missing = missingParts(order, placed)
  if (!missing.some((part) => part.id === partId)) return 'wrong'
  return missing.length === 1 ? 'complete' : 'added'
}

/**
 * The bot's finish time for each item, in seconds from the start (so they only go up).
 * It takes about 1.3 to 2.1 s per part, and now and then grabs a wrong one.
 */
export function botForgeTimes(seed: number, orders: readonly ForgeOrder[]): number[] {
  const random = seededRandom(seed ^ 0x2c1b3c6d)
  let time = 0
  return orders.map((order) => {
    time += 0.8
    for (let part = 0; part < order.recipe.length; part++) {
      time += 1.3 + random() * 0.8
      if (random() < 0.12) time += WRONG_PART_PENALTY
    }
    return time
  })
}

/** Items the bot has built at `seconds`. */
export const botItemsDone = (times: readonly number[], seconds: number): number =>
  times.filter((time) => time <= seconds).length
