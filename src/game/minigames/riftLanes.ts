/** The three lanes of the Rift, as the lane games (Destiny, Paranoia) use them. */
export type Lane = 0 | 1 | 2

export const LANES: readonly Lane[] = [0, 1, 2]
export const LANE_NAMES = ['Top', 'Mid', 'Bot'] as const

export const isLane = (value: unknown): value is Lane => value === 0 || value === 1 || value === 2

/** A spot on the minimap: 0–100 across (left to right) and down (top to bottom). */
export interface MapPoint {
  x: number
  y: number
}

/**
 * Where each lane is on the minimap: the top lane's corner, the middle of mid, and the bot lane's
 * corner. All three sit on the river, so a champion flying at one from a base is easy to read.
 */
export const LANE_SPOTS: Readonly<Record<Lane, MapPoint>> = {
  0: { x: 15, y: 15 },
  1: { x: 50, y: 50 },
  2: { x: 85, y: 85 },
}

/** A random lane from a random stream. */
export const randomLane = (random: () => number): Lane => LANES[Math.floor(random() * LANES.length)] ?? 1
