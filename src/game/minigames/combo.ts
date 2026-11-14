import { seededRandom } from '../random'
import { stepSeed, type BothMoves, type MiniGameRules, type Moves, type Owed, type Player } from './versus'

export const COMBO_KEYS = ['Q', 'W', 'E', 'R'] as const
export type ComboKey = (typeof COMBO_KEYS)[number]

/**
 * Riven's three combos of 4, 6 and 7 keys, each one new: nothing to do with the one before. A
 * wrong key doesn't end a combo; every right key counts. Solo and Multiplayer play the same.
 */
export const COMBO_LENGTHS = [4, 6, 7] as const
export const COMBO_ROUNDS = COMBO_LENGTHS.length
export const COMBO_MAX_SCORE = COMBO_LENGTHS.reduce((total, length) => total + length, 0)

/** Seconds each key is shown: 0.575 s for 4 keys, 0.525 s for 6, 0.5 s for 7. Riven does not wait. */
export const flashSeconds = (length: number): number => Math.round(675 - 25 * length) / 1000

/** The first key of a spam stays up longer, so nobody misses it while getting ready. */
export const FIRST_KEY_FACTOR = 1.8

/** Seconds to type in a combo of this length. */
export const inputSeconds = (length: number): number => 3 + length * 0.9

/**
 * The three combos of a game. Each starts with another key than the one before, so a combo is
 * never the last one with keys added.
 */
export function comboSpams(seed: number): ComboKey[][] {
  const spams: ComboKey[][] = []
  for (const [round, length] of COMBO_LENGTHS.entries()) {
    const random = seededRandom(stepSeed(seed, round, 7))
    const spam = Array.from({ length }, () => COMBO_KEYS[Math.floor(random() * COMBO_KEYS.length)] ?? 'Q')
    const before = spams[round - 1]?.[0]
    if (before && spam[0] === before) spam[0] = COMBO_KEYS[(COMBO_KEYS.indexOf(before) + 1) % COMBO_KEYS.length] ?? 'Q'
    spams.push(spam)
  }
  return spams
}

/** Keys typed in the right spot. Every right key counts, even after a mistake. */
export function rightKeys(spam: readonly ComboKey[], typed: readonly ComboKey[]): number {
  return typed.filter((key, index) => key === spam[index]).length
}

/** Reads a keyboard key as a combo key: Q, W, E or R (any case). */
export function toComboKey(key: string): ComboKey | null {
  const upper = key.toUpperCase()
  return COMBO_KEYS.find((comboKey) => comboKey === upper) ?? null
}

/**
 * The bot's right keys in one combo. A Gold Riven main: the short combo nearly always right, the
 * long ones often a key or two off. About 13 of 17 on average.
 */
export function botRightKeys(seed: number, round: number): number {
  const length = COMBO_LENGTHS[round] ?? 0
  const random = seededRandom(stepSeed(seed, round, 0x5bd1))
  return Math.max(0, length - Math.floor(random() * random() * (length + 1.5)))
}

/** A short cheer for a combo typed without a mistake. */
export function comboCheer(length: number): string {
  if (length <= 4) return 'Clean. Your Riven main friend nods.'
  if (length <= 6) return 'Animation cancelled. Riot is nervous.'
  return 'Fast Q, fast hands. Diamond Riven.'
}

/** Rounds played in a row from the first. */
const roundsPlayed = (moves: Moves): number => {
  let count = 0
  while (count < COMBO_ROUNDS && moves[count] !== undefined) count += 1
  return count
}

/** Right keys over all three combos, or null until all three are played. */
export function comboTotal(moves: Moves): number | null {
  if (roundsPlayed(moves) < COMBO_ROUNDS) return null
  return moves.slice(0, COMBO_ROUNDS).reduce<number>((total, keys) => total + (keys ?? 0), 0)
}

/** Each player owes the next combo's score until all three are in. */
function owed(moves: BothMoves): Owed[] {
  return ([0, 1] as const).flatMap((player: Player) => {
    const step = roundsPlayed(moves[player])
    return step < COMBO_ROUNDS ? [{ player, step }] : []
  })
}

export const COMBO_RULES: MiniGameRules = {
  chances: 1,
  // A 3-2-1, then per combo: the get-ready moment, the flashes (the first key longer), typing and the score.
  liveSeconds: () =>
    3 +
    COMBO_LENGTHS.reduce(
      (total, length) => total + 1.5 + (length + FIRST_KEY_FACTOR - 1) * (flashSeconds(length) + 0.14) + inputSeconds(length) + 1.5,
      0,
    ) +
    2,
  owed,
  settle: (moves) => {
    const a = comboTotal(moves[0])
    const b = comboTotal(moves[1])
    if (a === null || b === null) return null
    return { winner: a === b ? null : a > b ? 0 : 1, scores: [a, b] }
  },
  fallback: () => 0,
  botMove: (step, _moves, { seed }) => (step < COMBO_ROUNDS ? botRightKeys(seed, step) : undefined),
  formatScore: (keys) => `${keys} / ${COMBO_MAX_SCORE} keys`,
  best: { of: (moves) => comboTotal(moves[0]), lowerIsBetter: false, format: (keys) => `${keys} / ${COMBO_MAX_SCORE} keys` },
}
