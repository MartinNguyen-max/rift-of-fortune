import type { Champion, Item, Role } from '../../data/types'
import { CHAMPION_SCORE_WEIGHTS, TEAM_SCORE_WEIGHTS } from './config'
import { itemFitLine, roleFitLine } from './feedback'
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
  feedback: string[]
}

export interface TeamRating {
  score: number
  rank: Rank
  balance: TeamBalance
  champions: ChampionRating[]
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
  return { role, champion, roleFit, items: itemRatings, itemFit, score, feedback }
}

export function rateTeam(members: TeamMember[]): TeamRating {
  const champions = members.map(rateChampion)
  const balance = scoreTeamBalance(members)
  const score = Math.round(
    average(champions.map(({ score: championScore }) => championScore)) * TEAM_SCORE_WEIGHTS.champions +
      balance.score * TEAM_SCORE_WEIGHTS.balance,
  )
  return { score, rank: rankFor(score), balance, champions }
}
