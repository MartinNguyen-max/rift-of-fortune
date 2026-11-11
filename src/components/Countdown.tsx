import { useEffect, useState } from 'react'
import { formatCountdown, msUntilNextDaily } from '../game/daily'

/** "5h 04m 09s" until the next Daily, ticking every second. */
export function Countdown() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return <span className="font-mono tabular-nums">{formatCountdown(msUntilNextDaily(now))}</span>
}
