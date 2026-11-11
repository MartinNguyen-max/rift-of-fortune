import type { Champion, Item, Role } from '../../data/types'
import { coachNotes } from './coachNotes'
import { CHAMPION_SCORE_WEIGHTS } from './config'
import { itemFitLine, roleFitLine, verdictLine } from './feedback'
import { scoreItemFit } from './itemFit'
import { rankFor, type Rank } from './rank'
import { scoreRoleFit, type RoleFit } from './roleFit'
import { scoreTeamBalance, type TeamBalance, type TeamMember } from './teamBalance'

export interface ItemRating {
  item: Item
  fit: number
}

export interface ChampionRating {
  role: Role
  champion: Champion
  roleFit: RoleFit
  items: ItemRating[]
  itemFit: number
  score: number
  /** A short one-line verdict, e.g. "Hard carrying." */
  verdict: string
  feedback: string[]
}

export interface TeamRating {
  score: number
  rank: Rank
  /** Average champion score, before the balance penalty. */
  championAverage: number
  balance: TeamBalance
  champions: ChampionRating[]
  /** MVP, liability and jokes about the team as a whole. */
  coachNotes: string[]
}

const average = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

export function rateChampion({ role, champion, items }: TeamMember): ChampionRating {
  const roleFit = scoreRoleFit(champion, role)
  const itemRatings = items.map((item) => ({ item, fit: scoreItemFit(champion, item) }))
  const itemFit = Math.round(average(itemRatings.map(({ fit }) => fit)))
  const score = Math.round(roleFit.score * CHAMPION_SCORE_WEIGHTS.roleFit + itemFit * CHAMPION_SCORE_WEIGHTS.itemFit)

  const feedback = [
    roleFitLine(champion, role, roleFit.kind),
    ...itemRatings.flatMap(({ item, fit }) => itemFitLine(champion, item, fit) ?? []),
  ]
  return { role, champion, roleFit, items: itemRatings, itemFit, score, verdict: verdictLine(champion.id, score), feedback }
}

export function rateTeam(members: TeamMember[]): TeamRating {
  const champions = members.map(rateChampion)
  const balance = scoreTeamBalance(members)
  const championAverage = Math.round(average(champions.map(({ score: championScore }) => championScore)))
  const score = Math.max(0, championAverage - balance.penalty)
  return {
    score,
    rank: rankFor(score),
    championAverage,
    balance,
    champions,
    coachNotes: coachNotes(champions),
  }
}
