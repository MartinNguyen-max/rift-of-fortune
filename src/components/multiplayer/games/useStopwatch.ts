import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Seconds since `running` became true, updated every animation frame for smooth bars.
 * `read()` gives the exact time at the moment of a key press or tap, not the last frame's.
 */
export function useStopwatch(running: boolean) {
  const [seconds, setSeconds] = useState(0)
  const start = useRef<number | null>(null)

  useEffect(() => {
    if (!running) return
    start.current = performance.now()
    let frame = 0
    const tick = () => {
      if (start.current !== null) setSeconds((performance.now() - start.current) / 1000)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [running])

  const read = useCallback(() => (start.current === null ? 0 : (performance.now() - start.current) / 1000), [])
  return { seconds, read }
}

/** Calls `onPress` on Space or Enter, for players on a keyboard. */
export function usePressKey(onPress: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || (event.code !== 'Space' && event.code !== 'Enter')) return
      event.preventDefault()
      onPress()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPress, enabled])
}
