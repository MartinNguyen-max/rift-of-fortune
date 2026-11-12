import type { RandomFn } from '../random'

/** No 0/O or 1/I, so a code read out loud or from a screenshot can't be mistyped. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 5

export function createRoomCode(random: RandomFn = Math.random): string {
  return Array.from(
    { length: ROOM_CODE_LENGTH },
    () => ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)],
  ).join('')
}

export function isRoomCode(value: string): boolean {
  return value.length === ROOM_CODE_LENGTH && [...value].every((char) => ROOM_CODE_ALPHABET.includes(char))
}

/**
 * Turns whatever the player pasted into a room code: "k7q2x", " K7Q-2X " or a whole invite link.
 * Returns null when there is no valid code in it.
 */
export function parseRoomCode(input: string): string | null {
  const lastPart = input.trim().split('/').pop() ?? ''
  const code = lastPart.toUpperCase().replace(/[\s-]/g, '')
  return isRoomCode(code) ? code : null
}
