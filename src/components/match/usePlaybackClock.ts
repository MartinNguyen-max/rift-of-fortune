import { useEffect, useState } from 'react'

const TICK_MS = 50
/** A longer gap (the tab was in the background) pauses the match instead of skipping ahead. */
const MAX_STEP_SECONDS = 0.2

/** Real seconds since the match started playing. Stops at `total`; `skip` jumps there. */
export function usePlaybackClock(total: number, playing: boolean) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const step = Math.min(MAX_STEP_SECONDS, (now - last) / 1000)
      last = now
      setElapsed((current) => Math.min(total, current + step))
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [playing, total])

  return { elapsed, skip: () => setElapsed(total) }
}
