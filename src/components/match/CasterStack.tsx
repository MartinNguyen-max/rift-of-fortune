import { AnimatePresence, motion } from 'framer-motion'
import { CASTER_NAMES, type MatchLines } from '../../game/match/commentary'
import type { MatchEvent } from '../../game/match/types'
import { EventIcon } from './EventIcon'
import { SIDE_BORDER } from './matchStyles'

interface CasterStackProps {
  events: readonly MatchEvent[]
  lines: MatchLines
  /** How many events have happened so far. */
  shown: number
}

/** How many older lines peek out under the newest one. */
const PEEKING = 2

/** The casters' newest line on top, the older ones peeking out below it, smaller and faded. */
export function CasterStack({ events, lines, shown }: CasterStackProps) {
  const entries = events
    .slice(0, shown)
    .flatMap((event, index) => {
      const line = lines[index]
      return line ? [{ event, line, index }] : []
    })
    .slice(-(PEEKING + 1))
    .reverse()

  return (
    <div className="relative pb-5" aria-live="polite" aria-label="Casters">
      {entries.length === 0 && (
        <p className="rounded-lg border border-gold/20 bg-abyss/60 p-2 text-sm text-gold-light/60 italic">Minions are spawning…</p>
      )}
      <AnimatePresence initial={false}>
        {entries.map(({ event, line, index }, depth) => (
          <motion.div
            key={index}
            layout
            initial={{ opacity: 0, y: -16, scale: 1.05 }}
            animate={{ opacity: depth === 0 ? 1 : 0.45 - depth * 0.15, y: depth * 9, scale: 1 - depth * 0.05 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            style={{ zIndex: PEEKING + 1 - depth }}
            className={`${depth === 0 ? 'relative' : 'absolute inset-x-0 top-0'} rounded-lg border border-l-4 border-gold/40 bg-panel p-2.5 shadow-lg shadow-black/50 ${SIDE_BORDER[event.side]}`}
            aria-hidden={depth > 0}
          >
            <p className="flex items-center gap-2 text-sm font-bold text-gold">
              <EventIcon event={event} className="size-7 shrink-0 text-xl" />
              <span className="min-w-0 flex-1">“{line.text}”</span>
            </p>
            <p className="mt-0.5 text-right text-[11px] text-gold/70">— {CASTER_NAMES[line.caster]}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
