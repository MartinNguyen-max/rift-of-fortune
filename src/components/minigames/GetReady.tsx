import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

const COUNT_FROM = 3

/** "3, 2, 1" before a mini-game, then calls `onGo`. */
export function GetReady({ onGo }: { onGo: () => void }) {
  const [count, setCount] = useState(COUNT_FROM)

  useEffect(() => {
    if (count === 0) {
      onGo()
      return
    }
    const id = window.setTimeout(() => setCount(count - 1), 1000)
    return () => window.clearTimeout(id)
  }, [count, onGo])

  return (
    <div className="flex h-24 items-center justify-center" aria-live="assertive">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={count}
          initial={{ scale: 2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          className="font-display text-7xl font-black text-gold"
        >
          {count || 'GO'}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}
