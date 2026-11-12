import { seededRandom } from '../random'

export const COMBO_KEYS = ['Q', 'W', 'E', 'R'] as const
export type ComboKey = (typeof COMBO_KEYS)[number]

/** The first round's spam is this long; each round adds one key. */
export const COMBO_START_LENGTH = 3
/** No one gets past this. It is also the length of the generated spam. */
export const COMBO_MAX_LENGTH = 20

/** Seconds each key is shown: fast at first, faster as the spam grows. Udyr does not wait. */
export const flashSeconds = (length: number): number => Math.max(0.32, 0.62 - 0.03 * (length - COMBO_START_LENGTH))

/** Seconds to type in a spam of this length. */
export const inputSeconds = (length: number): number => 3 + length * 0.9

/** The whole spam for a game. Each round shows the first `length` keys of it. */
export function comboSpam(seed: number): ComboKey[] {
  const random = seededRandom(seed)
  return Array.from({ length: COMBO_MAX_LENGTH }, () => COMBO_KEYS[Math.floor(random() * COMBO_KEYS.length)] ?? 'Q')
}

export type ComboCheck = 'ok' | 'wrong' | 'complete'

/** Checks the keys typed so far against the first `length` keys of the spam. */
export function checkCombo(spam: readonly ComboKey[], length: number, typed: readonly ComboKey[]): ComboCheck {
  if (typed.some((key, index) => key !== spam[index])) return 'wrong'
  return typed.length >= length ? 'complete' : 'ok'
}

/** Reads a keyboard key as a combo key: Q, W, E or R (any case). */
export function toComboKey(key: string): ComboKey | null {
  const upper = key.toUpperCase()
  return COMBO_KEYS.find((comboKey) => comboKey === upper) ?? null
}

/**
 * The longest spam the bot remembers. A Gold Udyr: usually 6 to 9 keys, sometimes a little
 * more or less. The bot fails the round after it.
 */
export function botComboBest(seed: number): number {
  const random = seededRandom(seed ^ 0x5bd1e995)
  const roll = (random() + random()) / 2
  return Math.round(4 + roll * 7)
}

/** Fun lines between rounds, by the length just completed. */
export function comboCheer(length: number): string {
  if (length <= 4) return 'Warming up. Udyr clears faster than this.'
  if (length <= 6) return 'Spam detected. Riot approves.'
  if (length <= 8) return 'Your keyboard is filing a complaint.'
  if (length <= 10) return 'Challenger Udyr spotted. Still no combo.'
  return 'This is not a combo. This is a lifestyle.'
}
