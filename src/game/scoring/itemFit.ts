import type { Champion, Item } from '../../data/types'
import {
  CLASS_TAG_AFFINITY,
  DAMAGE_AFFINITY,
  ITEM_BUILD_FIT,
  NEUTRAL_ITEM_FIT,
  OFFENSIVE_TAGS,
  WRONG_DAMAGE_TYPE_AFFINITY,
  type ItemTag,
} from './config'
import { buildProfiles, itemBuyers } from './builds'

const has = (value: number | undefined) => (value ?? 0) > 0

/**
 * Classifies an item by its stats. Defensive stats only count as TANK when the item
 * has no offensive stats, so e.g. Zhonya's is an AP item rather than a tank item.
 */
export function getItemTags({ stats }: Item): ItemTag[] {
  const tags: ItemTag[] = []
  if (has(stats.attackDamage)) tags.push('AD')
  if (has(stats.abilityPower) || has(stats.magicPenetration)) tags.push('AP')
  if (has(stats.critChance)) tags.push('CRIT')
  if (has(stats.attackSpeed)) tags.push('ATTACK_SPEED')
  if (has(stats.lethality) || has(stats.armorPenetration)) tags.push('LETHALITY')
  if (has(stats.healAndShieldPower) || has(stats.manaRegen)) tags.push('ENCHANTER')

  const isOffensive = tags.some((tag) => OFFENSIVE_TAGS.includes(tag))
  if (!isOffensive && (has(stats.health) || has(stats.armor) || has(stats.magicResist))) tags.push('TANK')
  return tags
}

/** How much a champion wants one kind of item; uses the champion's best-matching class. */
export function tagAffinity(champion: Champion, tag: ItemTag): number {
  const perClass = champion.classes.map((championClass) => {
    if (tag === 'AD' || tag === 'AP') {
      return tag === champion.damageType ? DAMAGE_AFFINITY[championClass] : WRONG_DAMAGE_TYPE_AFFINITY
    }
    return CLASS_TAG_AFFINITY[championClass][tag]
  })
  return Math.max(0, ...perClass)
}

/** Average affinity over the item's tags: a crit item needs to be good for both AD and crit. Used for items the build table doesn't know. */
export function statItemFit(champion: Champion, item: Item): number {
  const tags = getItemTags(item)
  if (tags.length === 0) return NEUTRAL_ITEM_FIT
  const total = tags.reduce((sum, tag) => sum + tagAffinity(champion, tag), 0)
  return Math.round(total / tags.length)
}

/**
 * How well an item fits a champion, 0–100. Items the champion's main build profile buys fit
 * perfectly, items for their second profile almost; anything else is capped low, so knowing
 * what each champion builds matters.
 */
export function scoreItemFit(champion: Champion, item: Item): number {
  const statFit = statItemFit(champion, item)
  const buyers = itemBuyers(item.id)
  if (!buyers) return statFit
  const [main, ...others] = buildProfiles(champion)
  if (main && buyers.includes(main)) return ITEM_BUILD_FIT.main
  if (others.some((profile) => buyers.includes(profile))) return ITEM_BUILD_FIT.second
  return Math.min(statFit, ITEM_BUILD_FIT.offBuildCap)
}
