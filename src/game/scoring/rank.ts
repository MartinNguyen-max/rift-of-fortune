import type { RankTier } from '../../data/types'
import { DIVISIONS, RANK_THRESHOLDS, type Division } from './config'

export interface Rank {
  tier: RankTier
  /** `null` for Master and above, which have no divisions. */
  division: Division | null
  summary: string
}

const MAX_SCORE = 100

/** Maps a 0–100 team score to a ranked tier and division, e.g. 57 → Gold III. */
export function rankFor(score: number): Rank {
  const index = RANK_THRESHOLDS.findIndex(({ min }) => score >= min)
  const tierIndex = index === -1 ? RANK_THRESHOLDS.length - 1 : index
  const { tier, min, hasDivisions, summary } = RANK_THRESHOLDS[tierIndex] as (typeof RANK_THRESHOLDS)[number]
  if (!hasDivisions) return { tier, division: null, summary }

  // The tier's score range runs up to the next tier's minimum (exclusive).
  const ceiling = RANK_THRESHOLDS[tierIndex - 1]?.min ?? MAX_SCORE + 1
  const progress = (Math.max(score, min) - min) / (ceiling - min)
  const divisionIndex = Math.min(DIVISIONS.length - 1, Math.floor(progress * DIVISIONS.length))
  return { tier, division: DIVISIONS[divisionIndex] ?? null, summary }
}

/** "Gold II", or just "Master" for tiers without divisions. */
export const rankLabel = ({ tier, division }: Rank): string => (division ? `${tier} ${division}` : tier)
