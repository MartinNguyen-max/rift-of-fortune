import { ROLE_LABELS } from '../roles'
import { COACH_LINES, pickLine } from './feedback'
import type { ChampionRating } from './rateTeam'

/** Show a comp joke when at least this many champions share the same thing. */
const CROWD_SIZE = 3
const MARKSMAN_CROWD_SIZE = 2

const seedFor = (champions: ChampionRating[], topic: string) =>
  `${champions.map(({ champion }) => champion.id).join(',')}:${topic}`

/** The best pick of the team. */
export function mvpLine(champions: ChampionRating[]): string | null {
  const best = champions.reduce<ChampionRating | null>((top, rating) => (!top || rating.score > top.score ? rating : top), null)
  if (!best) return null
  return pickLine(COACH_LINES.mvp(best.champion.name, ROLE_LABELS[best.role]), seedFor(champions, 'mvp'))
}

/** The worst pick, unless everybody did about equally well. */
export function liabilityLine(champions: ChampionRating[]): string | null {
  const worst = champions.reduce<ChampionRating | null>(
    (bottom, rating) => (!bottom || rating.score < bottom.score ? rating : bottom),
    null,
  )
  const best = Math.max(...champions.map(({ score }) => score))
  if (!worst || worst.score === best) return null
  return pickLine(COACH_LINES.liability(worst.champion.name, ROLE_LABELS[worst.role]), seedFor(champions, 'liability'))
}

/** Jokes about the team as a whole, e.g. four junglers on one team. */
export function compLines(champions: ChampionRating[]): string[] {
  const count = (test: (rating: ChampionRating) => boolean) => champions.filter(test).length
  const junglers = count(({ champion }) => champion.positions.includes('JUNGLE'))
  const supports = count(({ champion }) => champion.positions.includes('SUPPORT'))
  const marksmen = count(({ champion }) => champion.classes.includes('Marksman'))
  const onRole = count(({ roleFit }) => roleFit.kind === 'onRole')
  const pick = (lines: readonly string[], topic: string) => pickLine(lines, seedFor(champions, topic))

  const lines: string[] = []
  if (junglers >= CROWD_SIZE) lines.push(pick(COACH_LINES.manyJunglers(junglers), 'junglers'))
  if (supports >= CROWD_SIZE) lines.push(pick(COACH_LINES.manySupports(supports), 'supports'))
  if (marksmen >= MARKSMAN_CROWD_SIZE) lines.push(pick(COACH_LINES.manyMarksmen(marksmen), 'marksmen'))
  if (champions.length > 0 && onRole === 0) lines.push(pick(COACH_LINES.nobodyOnRole(), 'onRole'))
  if (champions.length > 0 && onRole === champions.length) lines.push(pick(COACH_LINES.everyoneOnRole(), 'onRole'))
  return lines
}

export function coachNotes(champions: ChampionRating[]): string[] {
  return [mvpLine(champions), liabilityLine(champions), ...compLines(champions)].filter(
    (line): line is string => line !== null,
  )
}
