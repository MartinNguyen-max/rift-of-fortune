import type { Champion, Item, Role } from '../../data/types'
import {
  BALANCE_PENALTIES,
  BRUISER_CLASSES,
  CARRY_CLASSES,
  FRONTLINE_CLASSES,
  MIN_DAMAGE_ITEMS,
  OFFENSIVE_TAGS,
} from './config'
import { getItemTags } from './itemFit'

export interface TeamMember {
  role: Role
  champion: Champion
  items: Item[]
}

export type BalanceCheckId = keyof typeof BALANCE_PENALTIES

export interface BalanceCheck {
  id: BalanceCheckId
  passed: boolean
  /** Points taken off the balance score; 0 when passed. */
  penalty: number
  message: string
}

export interface TeamBalance {
  score: number
  checks: BalanceCheck[]
}

const hasClass = (champion: Champion, classes: readonly string[]) =>
  champion.classes.some((championClass) => classes.includes(championClass))

const isTankItem = (item: Item) => getItemTags(item).includes('TANK')
const isDamageItem = (item: Item) => getItemTags(item).some((tag) => OFFENSIVE_TAGS.includes(tag))

export function isFrontline({ champion, items }: TeamMember): boolean {
  return hasClass(champion, FRONTLINE_CLASSES) || (hasClass(champion, BRUISER_CLASSES) && items.some(isTankItem))
}

export function isCarry({ champion }: TeamMember): boolean {
  return hasClass(champion, CARRY_CLASSES)
}

function check(id: BalanceCheckId, passed: boolean, message: string): BalanceCheck {
  return { id, passed, penalty: passed ? 0 : BALANCE_PENALTIES[id], message }
}

export function checkDamageMix(members: TeamMember[]): BalanceCheck {
  const adCount = members.filter(({ champion }) => champion.damageType === 'AD').length
  if (adCount === members.length) {
    return check('oneDamageType', false, 'Full AD team. The enemy will just build armor.')
  }
  if (adCount === 0) {
    return check('oneDamageType', false, 'Full AP team. One Force of Nature and you are done.')
  }
  return check('oneDamageType', true, `Nice damage mix: ${adCount} AD, ${members.length - adCount} AP.`)
}

export function checkFrontline(members: TeamMember[]): BalanceCheck {
  const frontline = members.filter(isFrontline)
  if (frontline.length === 0) return check('noFrontline', false, "No frontline. Who's walking in first?")
  const names = frontline.map(({ champion }) => champion.name).join(' and ')
  return check('noFrontline', true, `${names} will hold the frontline.`)
}

export function checkCarries(members: TeamMember[]): BalanceCheck {
  return members.some(isCarry)
    ? check('noCarry', true, 'At least someone here knows how to carry.')
    : check('noCarry', false, 'No carries. This team plans to win by being annoying.')
}

export function checkDamageItems(members: TeamMember[]): BalanceCheck {
  const count = members.flatMap(({ items }) => items).filter(isDamageItem).length
  return count >= MIN_DAMAGE_ITEMS
    ? check('fewDamageItems', true, `${count} damage items. Something will die.`)
    : check('fewDamageItems', false, `Only ${count} damage item${count === 1 ? '' : 's'}. The enemy Nexus will die of old age.`)
}

export function scoreTeamBalance(members: TeamMember[]): TeamBalance {
  const checks = [checkDamageMix(members), checkFrontline(members), checkCarries(members), checkDamageItems(members)]
  const penalty = checks.reduce((sum, { penalty: points }) => sum + points, 0)
  return { score: Math.max(0, 100 - penalty), checks }
}
