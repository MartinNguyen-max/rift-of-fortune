import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

/** How long a hint stays up. */
const HINT_MS = 4500

interface HintBubbleProps {
  text: string
  /** Which edge of the parent the arrow lines up with. */
  align: 'left' | 'right'
}

/** A small bubble under its (relative) parent for a few seconds, pointing at what to tap. */
export function HintBubble({ text, align }: HintBubbleProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const id = window.setTimeout(() => setVisible(false), HINT_MS)
    return () => window.clearTimeout(id)
  }, [])

  const side = align === 'right' ? 'right-0' : 'left-0'
  const arrow = align === 'right' ? 'right-3' : 'left-3'
  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.8 }}
          className={`pointer-events-none absolute top-full ${side} z-10 mt-2 rounded-md border border-gold/50 bg-panel px-2 py-1 text-xs whitespace-nowrap text-gold-light shadow-lg`}
          role="status"
        >
          <span className={`absolute -top-1 ${arrow} size-2 rotate-45 border-t border-l border-gold/50 bg-panel`} aria-hidden="true" />
          {text}
        </motion.span>
      )}
    </AnimatePresence>
  )
}
