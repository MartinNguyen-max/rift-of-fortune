import { useEffect, useState } from 'react'

const TICK_MS = 200

/** Seconds left until `deadline` (a Date.now() timestamp), never below 0. */
export function useCountdown(deadline: number): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  return Math.max(0, (deadline - now) / 1000)
}
