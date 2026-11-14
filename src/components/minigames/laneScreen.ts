import { useEffect, type CSSProperties } from 'react'
import type { Lane, MapPoint } from '../../game/minigames/riftLanes'

/**
 * Two spots beside each lane's circle, inside the map: for a card, a second token, or the
 * players' calls, so nothing covers the lane's middle or falls off the edge.
 */
export const LANE_SIDES: Readonly<Record<Lane, readonly [MapPoint, MapPoint]>> = {
  0: [
    { x: 33, y: 12 },
    { x: 12, y: 35 },
  ],
  1: [
    { x: 67, y: 36 },
    { x: 33, y: 64 },
  ],
  2: [
    { x: 86, y: 63 },
    { x: 63, y: 84 },
  ],
}

const LANE_KEYS: Readonly<Record<string, Lane>> = {
  Digit1: 0,
  Numpad1: 0,
  ArrowUp: 0,
  Digit2: 1,
  Numpad2: 1,
  ArrowRight: 1,
  ArrowLeft: 1,
  Digit3: 2,
  Numpad3: 2,
  ArrowDown: 2,
}

/** Picks a lane with 1, 2, 3 (or up for top, left/right for mid, down for bot), for players on a keyboard. */
export function useLaneKeys(onPick: (lane: Lane) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      const lane = LANE_KEYS[event.code]
      if (lane === undefined || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      event.preventDefault()
      onPick(lane)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPick, enabled])
}

/** Puts something centered on a minimap spot (the parent is the map). */
export const placeAt = ({ x, y }: MapPoint): CSSProperties => ({ left: `${x}%`, top: `${y}%` })
