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

/** Team balance lines: one entry per check outcome. */
export const BALANCE_LINES = {
  goodDamageMix: (ad: number, ap: number) => [
    `Nice damage mix: ${ad} AD, ${ap} AP. The enemy can't just build one resist.`,
    `${ad} AD, ${ap} AP. Itemizing against this is a headache.`,
  ],
  lopsidedDamage: (majority: string, count: number, lone: string) => [
    `${count} ${majority} and a ${lone}. ${majority === 'AD' ? 'Armor' : 'Magic resist'} is on sale.`,
    `${count} ${majority} damage dealers and ${lone} doing the rest alone.`,
  ],
  fullAd: () => ['Full AD team. The enemy will just build armor.', 'Five AD champions. Thornmail sends its regards.'],
  fullAp: () => [
    'Full AP team. One Force of Nature and you are done.',
    'Five AP champions. Magic resist is cheap this season.',
  ],
  frontline: (names: string) => [`${names} will hold the frontline.`, `${names} will walk in first. Bravely.`],
  noFrontline: () => [
    "No frontline. Who's walking in first?",
    'No frontline. Everyone is waiting for someone else to engage.',
  ],
  tooManyFrontline: (count: number) => [
    `${count} frontliners. Everyone wants to go first, nobody wants to do damage.`,
    `${count} frontliners. Very hard to kill, very hard to lose to, very hard to win with.`,
  ],
  carries: (names: string) => [`${names} will carry. Hopefully.`, `${names} on carry duty. No pressure.`],
  noCarry: () => [
    'No real carry. This team plans to win by being annoying.',
    'No marksman, mage or assassin. Who is doing the damage?',
  ],
  marksmanBot: (name: string) => [`${name} in bot lane. Proper ADC.`, `${name} holding the bot lane. Classic.`],
  noMarksmanBot: (name: string) => [
    `${name} ADC. The minions are confused.`,
    `${name} in the ADC slot. Last hitting will be an adventure.`,
  ],
  someRanged: (count: number) => [
    `${count} ranged champion${count === 1 ? '' : 's'} to poke from safety.`,
    `${count} ranged champion${count === 1 ? '' : 's'}. Someone can hit from a distance.`,
  ],
  allMelee: () => ['Five melee champions. Enemy Caitlyn sends her thanks.', 'All melee. Kiting comps love this one trick.'],
  damageItems: (count: number) => [`${count} damage items. Something will die.`, `${count} damage items. Enough to hurt.`],
  fewDamageItems: (count: number) => [
    `Only ${count} damage item${count === 1 ? '' : 's'}. The enemy Nexus will die of old age.`,
    `Only ${count} damage item${count === 1 ? '' : 's'}. Fights will last a while.`,
  ],
} as const

/** Team-level jokes and awards for the coach's notes. */
export const COACH_LINES = {
  mvp: (name: string, role: string) => [
    `MVP: ${name} ${role}. Carrying this lobby on their back.`,
    `MVP: ${name} ${role}. The only one who read the patch notes.`,
    `MVP: ${name} ${role}. Somebody give them a raise.`,
  ],
  liability: (name: string, role: string) => [
    `Liability: ${name} ${role}. Already typing "jg diff".`,
    `Liability: ${name} ${role}. Will be reported, deserved.`,
    `Liability: ${name} ${role}. Already 0/3 and pinging everyone else.`,
  ],
  manyJunglers: (count: number) => [
    `${count} junglers on one team. Who is taking Smite?`,
    `${count} junglers. The enemy jungle has never been so busy.`,
  ],
  manySupports: (count: number) => [
    `${count} supports. Very safe, very slow, very many wards.`,
    `${count} supports. Somebody has to take the farm eventually.`,
  ],
  manyMarksmen: (count: number) => [
    `${count} marksmen. One bot lane. Somebody is farming the jungle now.`,
    `${count} marksmen. Glass cannon festival.`,
  ],
  nobodyOnRole: () => [
    'Nobody is playing their own role. Bold, chaotic, beautiful.',
    'Zero champions on their usual role. This is a Rift Roulette classic.',
  ],
  everyoneOnRole: () => [
    'Everyone is on their usual role. Suspiciously competent.',
    'All five on role. Did you look at a tier list?',
  ],
} as const

/** A short verdict per champion, from best to worst. */
export const VERDICT_LINES = [
  { min: 85, lines: ['Hard carrying.', 'Playing a different game.', 'Smurf detected.'] },
  { min: 65, lines: ['Pulling their weight.', 'Solid. No complaints.', 'Doing the job.'] },
  { min: 45, lines: ['Present. Mostly.', 'Could be worse.', 'Doing their best, apparently.'] },
  { min: 25, lines: ['Struggling.', 'Lost in the sauce.', 'Needs a hug and a guide.'] },
  { min: 0, lines: ['Inting.', 'The enemy\'s favourite player.', 'Will be blamed in post-game, rightly.'] },
] as const

export function verdictLine(championId: string, score: number): string {
  const band = VERDICT_LINES.find(({ min }) => score >= min) ?? VERDICT_LINES[VERDICT_LINES.length - 1]
  return pickLine(band?.lines ?? ['Present.'], `${championId}:verdict`)
}

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
