import type { Champion, Item, Role } from '../../data/types'
import { CHAMPION_SCORE_WEIGHTS, GRADES, TEAM_SCORE_WEIGHTS, type Grade } from './config'
import { itemFitLine, roleFitLine } from './feedback'
import { scoreItemFit } from './itemFit'
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
  grade: Grade
  summary: string
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

export function gradeFor(score: number): (typeof GRADES)[number] {
  const lowest = GRADES[GRADES.length - 1] as (typeof GRADES)[number]
  return GRADES.find(({ min }) => score >= min) ?? lowest
}

export function rateTeam(members: TeamMember[]): TeamRating {
  const champions = members.map(rateChampion)
  const balance = scoreTeamBalance(members)
  const score = Math.round(
    average(champions.map(({ score: championScore }) => championScore)) * TEAM_SCORE_WEIGHTS.champions +
      balance.score * TEAM_SCORE_WEIGHTS.balance,
  )
  const { grade, summary } = gradeFor(score)
  return { score, grade, summary, balance, champions }
}
