import type { Champion, ChampionClass, Item, Role } from '../../data/types'
import { ROLE_LABELS } from '../roles'
import { ITEM_FIT_THRESHOLDS } from './config'
import { getItemTags } from './itemFit'
import type { RoleFitKind } from './roleFit'

/**
 * Picks one of several lines. The choice depends only on `seed`, so the same
 * team always gets the same feedback (and tests stay deterministic), while
 * different champions and items get different lines.
 */
export function pickLine(lines: readonly string[], seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const line = lines[hash % lines.length]
  if (line === undefined) throw new Error('pickLine needs at least one line')
  return line
}

/** All feedback lines, grouped by situation. Exported so tests can check against them. */
export const LINES = {
  onRole: (name: string, role: string) => [
    `${name} in ${role}. Textbook.`,
    `${name} in ${role}. Exactly where they belong.`,
    `${name} ${role}. The scouts approve.`,
  ],
  classFit: (name: string, role: string) => [
    `${name} isn't a usual ${role}, but it can work.`,
    `${name} in ${role}? Off-meta, not off the rails.`,
    `${name} ${role}. Not standard, but somebody on Reddit swears by it.`,
  ],
  offRole: (name: string, role: string) => [
    `${name} ${role}? Bold. Very bold.`,
    `${name} in ${role}. Nobody told them where to go.`,
    `${name} ${role}. This is how you get flamed in champ select.`,
  ],
  goodItem: (who: string) => [`${who}: great fit.`, `${who}: chef's kiss.`, `${who}: exactly what they wanted.`],
  critOnTank: (who: string, championClass: string) => [
    `${who}? Crit on a ${championClass}, sure.`,
    `${who}. A ${championClass} with crit. The enemy is confused, not scared.`,
  ],
  enchanterOnCarry: (who: string) => [
    `${who}. Healing allies is nice, but that's not really the job.`,
    `${who}. Shields for everyone, damage for no one.`,
  ],
  apOnAd: (who: string) => [
    `${who}. All that AP and nowhere to put it.`,
    `${who}. The AP is purely decorative.`,
  ],
  adOnAp: (who: string) => [`${who}. Auto attacks won't save you.`, `${who}. Spells scale with AP, just saying.`],
  tankOnCarry: (who: string) => [`${who}: very safe, very harmless.`, `${who}. Unkillable and also useless.`],
  uselessItem: (who: string) => [`${who} does nothing.`, `${who}: the shop misclick of the year.`],
} as const

/** Special lines for a champion class played in a role it really doesn't belong in. */
const OFF_ROLE_LINES: Partial<Record<`${ChampionClass}:${Role}`, string>> = {
  'Support:TOP': 'Support in top lane, brave choice.',
  'Support:JUNGLE': 'A support jungler. The camps will take a while.',
  'Marksman:JUNGLE': 'A marksman in the jungle. Scuttle Crab fears nothing.',
  'Marksman:SUPPORT': 'Two ADCs in bot lane. Who is getting the farm?',
  'Tank:BOTTOM': 'A tank as ADC. Bold strategy to never kill anything.',
  'Mage:JUNGLE': 'A mage in the jungle. Hope the clear speed is fine.',
  'Assassin:SUPPORT': 'An assassin on support. The enemy ADC already feels uneasy.',
  'Fighter:SUPPORT': 'A fighter on support. Lane bully or lane disaster.',
}

export function roleFitLine(champion: Champion, role: Role, kind: RoleFitKind): string {
  const roleName = ROLE_LABELS[role]
  const seed = `${champion.id}:${role}`
  if (kind === 'offRole') {
    const special = champion.classes
      .map((championClass) => OFF_ROLE_LINES[`${championClass}:${role}`])
      .find((line) => line !== undefined)
    if (special) return special
  }
  return pickLine(LINES[kind](champion.name, roleName), seed)
}

const findClass = (champion: Champion, ...classes: ChampionClass[]) =>
  champion.classes.find((championClass) => classes.includes(championClass))

function badItemLines(champion: Champion, item: Item): readonly string[] {
  const tags = getItemTags(item)
  const who = `${item.name} on ${champion.name}`
  const nonCarryClass = findClass(champion, 'Tank', 'Support')

  if (tags.includes('CRIT') && nonCarryClass) return LINES.critOnTank(who, nonCarryClass.toLowerCase())
  if (tags.includes('ENCHANTER')) return LINES.enchanterOnCarry(who)
  if (tags.includes('AP') && champion.damageType === 'AD') return LINES.apOnAd(who)
  if (tags.includes('AD') && champion.damageType === 'AP') return LINES.adOnAp(who)
  if (tags.includes('TANK')) return LINES.tankOnCarry(who)
  return LINES.uselessItem(who)
}

/** Returns a line for clearly good or clearly bad items, nothing for the boring middle. */
export function itemFitLine(champion: Champion, item: Item, fit: number): string | null {
  const seed = `${champion.id}:${item.id}`
  if (fit >= ITEM_FIT_THRESHOLDS.good) return pickLine(LINES.goodItem(`${item.name} on ${champion.name}`), seed)
  if (fit <= ITEM_FIT_THRESHOLDS.bad) return pickLine(badItemLines(champion, item), seed)
  return null
}
