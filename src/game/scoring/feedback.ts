import type { Champion, ChampionClass, Item, Role } from '../../data/types'
import { ROLE_LABELS } from '../roles'
import { ITEM_FIT_THRESHOLDS } from './config'
import { getItemTags } from './itemFit'
import type { RoleFitKind } from './roleFit'

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
  switch (kind) {
    case 'onRole':
      return `${champion.name} in ${roleName}. Textbook.`
    case 'classFit':
      return `${champion.name} isn't a usual ${roleName}, but it can work.`
    case 'offRole': {
      const special = champion.classes
        .map((championClass) => OFF_ROLE_LINES[`${championClass}:${role}`])
        .find((line) => line !== undefined)
      return special ?? `${champion.name} ${roleName}? Bold. Very bold.`
    }
  }
}

const findClass = (champion: Champion, ...classes: ChampionClass[]) =>
  champion.classes.find((championClass) => classes.includes(championClass))

function badItemLine(champion: Champion, item: Item): string {
  const tags = getItemTags(item)
  const who = `${item.name} on ${champion.name}`
  const nonCarryClass = findClass(champion, 'Tank', 'Support')

  if (tags.includes('CRIT') && nonCarryClass) return `${who}? Crit on a ${nonCarryClass.toLowerCase()}, sure.`
  if (tags.includes('ENCHANTER')) return `${who}. Healing allies is nice, but that's not really the job.`
  if (tags.includes('AP') && champion.damageType === 'AD') return `${who}. All that AP and nowhere to put it.`
  if (tags.includes('AD') && champion.damageType === 'AP') return `${who}. Auto attacks won't save you.`
  if (tags.includes('TANK')) return `${who}: very safe, very harmless.`
  return `${item.name} does nothing for ${champion.name}.`
}

/** Returns a line for clearly good or clearly bad items, nothing for the boring middle. */
export function itemFitLine(champion: Champion, item: Item, fit: number): string | null {
  if (fit >= ITEM_FIT_THRESHOLDS.good) return `${item.name} on ${champion.name}: great fit.`
  if (fit <= ITEM_FIT_THRESHOLDS.bad) return badItemLine(champion, item)
  return null
}
