import type { MatchResult, MatchTeams, Scoreboard } from './types'

/**
 * How much each lead is worth in the win-chance formula (logistic weights).
 * Fitted on 6,000 simulated matches, so a team shown at 70% wins about 70% of the time.
 */
export const WIN_CHANCE_WEIGHTS = {
  /** Per point of team rating (0–100) above the enemy. */
  rating: 0.056,
  /** Per 10% gold lead, measured against the average team gold. */
  goldShare: 0.52,
  tower: 0.19,
  inhibitor: 0.66,
  baron: 0.17,
} as const

const logistic = (value: number) => 1 / (1 + Math.exp(-value))

/** Blue's chance to win, 0–1, from the team ratings and the score so far (null before the first event). */
export function blueWinChance(teams: MatchTeams, score: Scoreboard | null): number {
  const weights = WIN_CHANCE_WEIGHTS
  const rating = (teams.blue.rating.score - teams.red.rating.score) * weights.rating
  if (!score) return logistic(rating)

  const { blue, red } = score
  const goldShare = ((blue.gold - red.gold) / ((blue.gold + red.gold) / 2)) * 10
  return logistic(
    rating +
      goldShare * weights.goldShare +
      (blue.towers - red.towers) * weights.tower +
      (blue.inhibitors - red.inhibitors) * weights.inhibitor +
      (blue.barons - red.barons) * weights.baron,
  )
}

/**
 * Blue's win chance before the match (index 0) and after each event (index i + 1).
 * The last event ends the match, so the last value is exactly 0 or 1.
 */
export function winChanceTimeline(match: MatchResult, teams: MatchTeams): number[] {
  const during = match.events.slice(0, -1).map(({ score }) => blueWinChance(teams, score))
  return [blueWinChance(teams, null), ...during, match.winner === 'blue' ? 1 : 0]
}

/** Whole percentages for the bar. Stays between 1% and 99% until the match is over. */
export function formatWinChance(chance: number): { blue: number; red: number } {
  const blue = chance === 0 || chance === 1 ? chance * 100 : Math.min(99, Math.max(1, Math.round(chance * 100)))
  return { blue, red: 100 - blue }
}
