import { useEffect, useRef } from 'react'

/** Calls `callback` once, `ms` after `active` turns true. */
export function useTimeout(callback: () => void, ms: number, active = true) {
  const latest = useRef(callback)
  useEffect(() => {
    latest.current = callback
  }, [callback])
  useEffect(() => {
    if (!active) return
    const id = window.setTimeout(() => latest.current(), ms)
    return () => window.clearTimeout(id)
  }, [ms, active])
}

/** Calls `onShown` once the game is over and its last moment had `delayMs` to play. */
export function useShownWhen(over: boolean, onShown: () => void, delayMs = 1600) {
  const called = useRef(false)
  useTimeout(
    () => {
      if (called.current) return
      called.current = true
      onShown()
    },
    delayMs,
    over,
  )
}
