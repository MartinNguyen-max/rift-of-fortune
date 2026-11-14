import type { Item, ItemComponent } from '../../data/types'
import { sample, seededRandom, type RandomFn } from '../random'
import { owedScores, settleScores, type MiniGameRules, type Variant } from './versus'

/** Items to build in one game: two easy ones with 2 parts, then one with 3. */
export const ORDER_PARTS = [2, 2, 3] as const
export const FORGE_ITEM_COUNT = ORDER_PARTS.length
/** Parts on offer for each item: the recipe plus decoys. Multiplayer offers fewer, to keep it quick. */
export const TRAY_SIZES: Record<Variant, readonly number[]> = { solo: [6, 6, 7], live: [4, 4, 6] }
/** Seconds added to your time for each wrong part. */
export const WRONG_PART_PENALTY = 2
/** Multiplayer: the most a forge can take. Not done by then counts as this time. */
export const FORGE_LIMIT_SECONDS = 40

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

/**
 * The orders for one game, the same for everyone with this seed: different items with 2, 2 and
 * 3 parts (any size if the data has too few), each with its tray of parts.
 */
export function forgeOrders(
  seed: number,
  items: readonly Item[],
  components: readonly ItemComponent[],
  variant: Variant = 'solo',
): ForgeOrder[] {
  const random = seededRandom(seed)
  const byId = new Map(components.map((component) => [component.id, component]))
  const pool = forgeableItems(items, components)
  const chosen: Item[] = []
  for (const parts of ORDER_PARTS) {
    const fitting = pool.filter((item) => item.from.length === parts && !chosen.includes(item))
    const options = fitting.length > 0 ? fitting : pool.filter((item) => !chosen.includes(item))
    const [item] = sample(options, 1, random)
    if (item) chosen.push(item)
  }
  return chosen.map((item, index) => {
    const recipe = item.from.flatMap((id) => byId.get(id) ?? [])
    const parts = [...new Map(recipe.map((part) => [part.id, part])).values()]
    const traySize = TRAY_SIZES[variant][index] ?? 6
    const decoys = sample(
      components.filter((component) => !item.from.includes(component.id)),
      Math.max(0, traySize - parts.length),
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

/** Adds a part to the item being stitched: right if the build still needs it. */
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

/** The rules, with the items and parts the orders come from. Scores are times in ms: lower wins. */
export const forgeRules = (items: readonly Item[], components: readonly ItemComponent[]): MiniGameRules => ({
  chances: 1,
  liveSeconds: () => FORGE_LIMIT_SECONDS + 6,
  owed: owedScores,
  settle: (moves) => settleScores(moves, true),
  fallback: () => FORGE_LIMIT_SECONDS * 1000,
  botMove: (step, _moves, { seed, variant }) =>
    step === 0 ? Math.round((botForgeTimes(seed, forgeOrders(seed, items, components, variant)).at(-1) ?? 0) * 1000) : undefined,
  formatScore: (ms) => (ms >= FORGE_LIMIT_SECONDS * 1000 ? 'Not finished' : `${(ms / 1000).toFixed(2)} s`),
  best: {
    // An unfinished forge is no record.
    of: (moves) => {
      const ms = moves[0][0]
      return ms !== undefined && ms < FORGE_LIMIT_SECONDS * 1000 ? ms : null
    },
    lowerIsBetter: true,
    format: (ms) => `${(ms / 1000).toFixed(2)} s`,
  },
})
