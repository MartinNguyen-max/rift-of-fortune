import { AnimatePresence, motion } from 'framer-motion'
import { EMOTES, type Emote } from '../../game/multiplayer/protocol'
import type { FlyingEmote } from './useRoom'

/** Tap to spam. Both players see every emote fly up the screen. */
export function EmoteBar({ onEmote }: { onEmote: (emote: Emote) => void }) {
  return (
    <div role="group" aria-label="Emotes" className="flex flex-wrap justify-center gap-1.5">
      {EMOTES.map((emote) => (
        <button
          key={emote}
          type="button"
          onClick={() => onEmote(emote)}
          className="min-w-11 rounded-full border border-gold/40 bg-panel/80 px-3 py-1.5 font-display text-sm font-bold text-gold-light transition hover:border-gold hover:bg-gold/15 active:scale-90"
        >
          {emote}
        </button>
      ))}
    </div>
  )
}

/** Emotes flying up from the bottom of the screen: blue for yours, red for the opponent's. */
export function EmoteLayer({ emotes }: { emotes: readonly FlyingEmote[] }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        {emotes.map(({ key, emote, mine, x }) => (
          <motion.span
            key={key}
            initial={{ y: 0, opacity: 0, scale: 0.6 }}
            animate={{ y: '-70vh', opacity: [0, 1, 1, 0], scale: [0.6, 1.3, 1.1, 1], rotate: mine ? -8 : 8 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: 'easeOut' }}
            style={{ left: `${x * 100}%` }}
            className={`absolute bottom-6 -translate-x-1/2 font-display text-3xl font-black drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:text-5xl ${
              mine ? 'text-hextech' : 'text-red-400'
            }`}
          >
            {emote}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}
