import { useEffect, useState } from 'react'
import { GAME_SECONDS_PER_SECOND, type Speed } from '../../game/match/playback'

const TICK_MS = 100

/** A game clock (in game seconds) that runs while `playing` and stops at `end`. */
export function useMatchClock(start: number, end: number, speed: Speed, playing: boolean) {
  const [clock, setClock] = useState(start)

  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const step = ((now - last) / 1000) * GAME_SECONDS_PER_SECOND * speed
      last = now
      setClock((current) => Math.min(end, current + step))
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [playing, speed, end])

  return { clock, skip: () => setClock(end) }
}
