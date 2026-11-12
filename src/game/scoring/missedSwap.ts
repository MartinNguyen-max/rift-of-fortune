import type { Item, Role } from '../../data/types'
import { rateTeam, type TeamRating } from './rateTeam'
import type { TeamMember } from './teamBalance'

/** Only point out swaps worth at least this many team points. */
export const MIN_SWAP_GAIN = 2

export interface MissedSwap {
  first: { role: Role; item: Item }
  second: { role: Role; item: Item }
  /** Team points the swap would have added. */
  gain: number
}

const membersOf = (rating: TeamRating): TeamMember[] =>
  rating.champions.map(({ role, champion, items }) => ({ role, champion, items: items.map(({ item }) => item) }))

/**
 * The single item swap between two champions that would have raised the team score the most,
 * or null when no swap gains at least MIN_SWAP_GAIN. Teaches which item belonged where.
 */
export function bestMissedSwap(rating: TeamRating): MissedSwap | null {
  const members = membersOf(rating)
  let best: MissedSwap | null = null
  for (const [a, first] of members.entries()) {
    for (const [b, second] of members.entries()) {
      if (b <= a) continue
      for (const [i, firstItem] of first.items.entries()) {
        for (const [j, secondItem] of second.items.entries()) {
          if (firstItem.id === secondItem.id) continue
          const swapped = members.map((member, index) => {
            if (index === a) return { ...member, items: member.items.map((item, k) => (k === i ? secondItem : item)) }
            if (index === b) return { ...member, items: member.items.map((item, k) => (k === j ? firstItem : item)) }
            return member
          })
          const gain = rateTeam(swapped).score - rating.score
          if (gain >= MIN_SWAP_GAIN && gain > (best?.gain ?? 0)) {
            best = { first: { role: first.role, item: firstItem }, second: { role: second.role, item: secondItem }, gain }
          }
        }
      }
    }
  }
  return best
}
