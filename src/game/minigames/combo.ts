import { seededRandom } from '../random'
import { stepSeed, type BothMoves, type MiniGameRules, type Moves, type Owed, type Player } from './versus'

export const COMBO_KEYS = ['Q', 'W', 'E', 'R'] as const
export type ComboKey = (typeof COMBO_KEYS)[number]

/**
 * Three spams of 3, 5 and 7 keys, each one new: nothing to do with the one before. A wrong key
 * doesn't end a spam; every right key counts. Solo and Multiplayer play the same.
 */
export const COMBO_LENGTHS = [3, 5, 7] as const
export const COMBO_ROUNDS = COMBO_LENGTHS.length
export const COMBO_MAX_SCORE = COMBO_LENGTHS.reduce((total, length) => total + length, 0)

/** Seconds each key is shown: 0.6 s for 3 keys, 0.55 s for 5, 0.5 s for 7. Udyr does not wait. */
export const flashSeconds = (length: number): number => Math.round(600 - 25 * (length - COMBO_LENGTHS[0])) / 1000

/** The first key of a spam stays up longer, so nobody misses it while getting ready. */
export const FIRST_KEY_FACTOR = 1.8

/** Seconds to type in a spam of this length. */
export const inputSeconds = (length: number): number => 3 + length * 0.9

/**
 * The three spams of a game. Each starts with another key than the one before, so a spam is
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
 * The bot's right keys in one spam. A Gold Udyr: the short spam nearly always right, the long
 * one often a key or two off. About 12.5 of 15 on average.
 */
export function botRightKeys(seed: number, round: number): number {
  const length = COMBO_LENGTHS[round] ?? 0
  const random = seededRandom(stepSeed(seed, round, 0x5bd1))
  return length - Math.floor(random() * random() * length)
}

/** A short cheer for a spam typed without a mistake. */
export function comboCheer(length: number): string {
  if (length <= 3) return 'Warming up. Udyr clears faster than this.'
  if (length <= 5) return 'Spam detected. Riot approves.'
  return 'Your keyboard is filing a complaint.'
}

/** Rounds played in a row from the first. */
const roundsPlayed = (moves: Moves): number => {
  let count = 0
  while (count < COMBO_ROUNDS && moves[count] !== undefined) count += 1
  return count
}

/** Right keys over all three spams, or null until all three are played. */
export function comboTotal(moves: Moves): number | null {
  if (roundsPlayed(moves) < COMBO_ROUNDS) return null
  return moves.slice(0, COMBO_ROUNDS).reduce<number>((total, keys) => total + (keys ?? 0), 0)
}

/** Each player owes the next spam's score until all three are in. */
function owed(moves: BothMoves): Owed[] {
  return ([0, 1] as const).flatMap((player: Player) => {
    const step = roundsPlayed(moves[player])
    return step < COMBO_ROUNDS ? [{ player, step }] : []
  })
}

export const COMBO_RULES: MiniGameRules = {
  chances: 1,
  // A 3-2-1, then per spam: the get-ready moment, the flashes (the first key longer), typing and the score.
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
