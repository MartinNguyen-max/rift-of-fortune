import type { Player } from './versus'

/** Your personal record in one mini-game against the bot. */
export interface MiniGameRecord {
  played: number
  wins: number
  /** Wins in a row right now. */
  streak: number
  bestStreak: number
  /** The best score (fastest time, most gold...) for games that keep one. */
  best: number | null
}

export const emptyRecord = (): MiniGameRecord => ({ played: 0, wins: 0, streak: 0, bestStreak: 0, best: null })

export interface GameOutcome {
  /** Null for a draw. You are player 0. */
  winner: Player | null
  /** Your score for the personal best, or null if the game keeps none (or you had no score). */
  score: number | null
  lowerIsBetter: boolean
}

export interface RecordUpdate {
  record: MiniGameRecord
  newBest: boolean
  /** A new longest win streak (from 2 wins in a row). */
  newBestStreak: boolean
}

/** Adds a finished game. A loss ends the win streak; a draw leaves it as it is. */
export function addOutcome(record: MiniGameRecord, { winner, score, lowerIsBetter }: GameOutcome): RecordUpdate {
  const won = winner === 0
  const streak = won ? record.streak + 1 : winner === null ? record.streak : 0
  const improves = score !== null && (record.best === null || (lowerIsBetter ? score < record.best : score > record.best))
  const next: MiniGameRecord = {
    played: record.played + 1,
    wins: record.wins + (won ? 1 : 0),
    streak,
    bestStreak: Math.max(record.bestStreak, streak),
    best: improves ? score : record.best,
  }
  return { record: next, newBest: improves, newBestStreak: streak > record.bestStreak && streak >= 2 }
}

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0

/** Reads a stored record, or null if it is damaged. */
export function parseRecord(value: unknown): MiniGameRecord | null {
  if (typeof value !== 'object' || value === null) return null
  const { played, wins, streak, bestStreak, best } = value as Record<string, unknown>
  if (![played, wins, streak, bestStreak].every(isCount)) return null
  if (best !== null && typeof best !== 'number') return null
  return { played, wins, streak, bestStreak, best } as MiniGameRecord
}
