import type { Champion, Item, Role } from '../../data/types'
import {
  BALANCE_PENALTIES,
  BRUISER_CLASSES,
  CARRY_CLASSES,
  FRONTLINE_CLASSES,
  MAX_BALANCE_PENALTY,
  MAX_FRONTLINE,
  MIN_DAMAGE_ITEMS,
  OFFENSIVE_TAGS,
} from './config'
import { BALANCE_LINES, pickLine } from './feedback'
import { getItemTags } from './itemFit'

export interface TeamMember {
  role: Role
  champion: Champion
  items: Item[]
}

export type BalancePenaltyId = keyof typeof BALANCE_PENALTIES
export type BalanceCheckId = 'damageMix' | 'frontline' | 'carry' | 'botLane' | 'range' | 'damageItems'

export interface BalanceCheck {
  id: BalanceCheckId
  passed: boolean
  /** Points taken off the team score; 0 when passed. */
  penalty: number
  message: string
}

export interface TeamBalance {
  /** Total points taken off the team score, capped at `MAX_BALANCE_PENALTY`. */
  penalty: number
  checks: BalanceCheck[]
}

const hasClass = (champion: Champion, classes: readonly string[]) =>
  champion.classes.some((championClass) => classes.includes(championClass))

const isTankItem = (item: Item) => getItemTags(item).includes('TANK')
const isDamageItem = (item: Item) => getItemTags(item).some((tag) => OFFENSIVE_TAGS.includes(tag))

/** "A", "A and B", or "A, B and C". */
export function joinNames(members: TeamMember[]): string {
  const names = members.map(({ champion }) => champion.name)
  const last = names.pop()
  return names.length > 0 ? `${names.join(', ')} and ${last}` : (last ?? '')
}

/** Seed for picking line variants: the same team always gets the same lines. */
const teamSeed = (members: TeamMember[], id: BalanceCheckId) =>
  `${members.map(({ champion }) => champion.id).join(',')}:${id}`

export function isFrontline({ champion, items }: TeamMember): boolean {
  return hasClass(champion, FRONTLINE_CLASSES) || (hasClass(champion, BRUISER_CLASSES) && items.some(isTankItem))
}

/** Only the main class counts, so a Fighter/Assassin like Vi is not a carry. */
export function isCarry({ champion }: TeamMember): boolean {
  const [mainClass] = champion.classes
  return mainClass !== undefined && CARRY_CLASSES.includes(mainClass)
}

function passed(members: TeamMember[], id: BalanceCheckId, lines: readonly string[]): BalanceCheck {
  return { id, passed: true, penalty: 0, message: pickLine(lines, teamSeed(members, id)) }
}

function failed(
  members: TeamMember[],
  id: BalanceCheckId,
  penaltyId: BalancePenaltyId,
  lines: readonly string[],
): BalanceCheck {
  return { id, passed: false, penalty: BALANCE_PENALTIES[penaltyId], message: pickLine(lines, teamSeed(members, id)) }
}

export function checkDamageMix(members: TeamMember[]): BalanceCheck {
  const ad = members.filter(({ champion }) => champion.damageType === 'AD')
  const ap = members.filter(({ champion }) => champion.damageType === 'AP')
  if (ap.length === 0) return failed(members, 'damageMix', 'oneDamageType', BALANCE_LINES.fullAd())
  if (ad.length === 0) return failed(members, 'damageMix', 'oneDamageType', BALANCE_LINES.fullAp())

  const [majority, minority] = ad.length > ap.length ? [ad, ap] : [ap, ad]
  if (minority.length === 1 && majority.length >= 3) {
    const majorityType = ad.length > ap.length ? 'AD' : 'AP'
    return failed(
      members,
      'damageMix',
      'lopsidedDamage',
      BALANCE_LINES.lopsidedDamage(majorityType, majority.length, joinNames(minority)),
    )
  }
  return passed(members, 'damageMix', BALANCE_LINES.goodDamageMix(ad.length, ap.length))
}

export function checkFrontline(members: TeamMember[]): BalanceCheck {
  const frontline = members.filter(isFrontline)
  if (frontline.length === 0) return failed(members, 'frontline', 'noFrontline', BALANCE_LINES.noFrontline())
  if (frontline.length >= MAX_FRONTLINE) {
    return failed(members, 'frontline', 'tooManyFrontline', BALANCE_LINES.tooManyFrontline(frontline.length))
  }
  return passed(members, 'frontline', BALANCE_LINES.frontline(joinNames(frontline)))
}

export function checkCarries(members: TeamMember[]): BalanceCheck {
  const carries = members.filter(isCarry)
  return carries.length > 0
    ? passed(members, 'carry', BALANCE_LINES.carries(joinNames(carries)))
    : failed(members, 'carry', 'noCarry', BALANCE_LINES.noCarry())
}

export function checkBotLane(members: TeamMember[]): BalanceCheck {
  const adc = members.find(({ role }) => role === 'BOTTOM')
  if (!adc) return passed(members, 'botLane', ['Nobody in bot lane yet.'])
  return adc.champion.classes.includes('Marksman')
    ? passed(members, 'botLane', BALANCE_LINES.marksmanBot(adc.champion.name))
    : failed(members, 'botLane', 'noMarksmanBot', BALANCE_LINES.noMarksmanBot(adc.champion.name))
}

export function checkRange(members: TeamMember[]): BalanceCheck {
  const ranged = members.filter(({ champion }) => champion.attackType === 'RANGED').length
  return ranged > 0
    ? passed(members, 'range', BALANCE_LINES.someRanged(ranged))
    : failed(members, 'range', 'allMelee', BALANCE_LINES.allMelee())
}

export function checkDamageItems(members: TeamMember[]): BalanceCheck {
  const count = members.flatMap(({ items }) => items).filter(isDamageItem).length
  return count >= MIN_DAMAGE_ITEMS
    ? passed(members, 'damageItems', BALANCE_LINES.damageItems(count))
    : failed(members, 'damageItems', 'fewDamageItems', BALANCE_LINES.fewDamageItems(count))
}

export function scoreTeamBalance(members: TeamMember[]): TeamBalance {
  const checks = [
    checkDamageMix(members),
    checkFrontline(members),
    checkCarries(members),
    checkBotLane(members),
    checkRange(members),
    checkDamageItems(members),
  ]
  const total = checks.reduce((sum, { penalty }) => sum + penalty, 0)
  return { penalty: Math.min(MAX_BALANCE_PENALTY, total), checks }
}
