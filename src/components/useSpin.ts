import { useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { sample } from '../game/random'

interface SpinOptions<T> {
  /** The value the spin lands on. */
  target: T
  /** Random values to flash by before landing. */
  pool: readonly T[]
  /** How many random values to show. Skipped when the OS asks for reduced motion. */
  spinFrames: number
  /** Delay after each frame. Growing delays make the spin slow down. Keep it a stable function. */
  delayMs: (frame: number) => number
  /** Image to preload for each frame. Keep it a stable function. */
  imageUrl: (value: T) => string
  onLanded: () => void
}

/** Slot-machine spin: cycles through random values, slowing down, then lands on `target`. */
export function useSpin<T>({ target, pool, spinFrames, delayMs, imageUrl, onLanded }: SpinOptions<T>) {
  const [frame, setFrame] = useState<T | null>(null)
  const [landed, setLanded] = useState(false)
  const reduceMotion = useReducedMotion() === true

  const onLandedRef = useRef(onLanded)
  useEffect(() => {
    onLandedRef.current = onLanded
  })

  useEffect(() => {
    const frames = [...sample(pool, reduceMotion ? 0 : spinFrames), target]
    for (const value of frames) new Image().src = imageUrl(value)

    let index = 0
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const next = frames[index]
      if (next === undefined) return
      setFrame(next)
      if (index === frames.length - 1) {
        setLanded(true)
        onLandedRef.current()
        return
      }
      timer = setTimeout(tick, delayMs(index))
      index++
    }
    timer = setTimeout(tick, 0)
    return () => clearTimeout(timer)
  }, [target, pool, spinFrames, delayMs, imageUrl, reduceMotion])

  return { frame, landed }
}
