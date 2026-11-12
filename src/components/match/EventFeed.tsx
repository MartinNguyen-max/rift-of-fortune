import { motion } from 'framer-motion'
import { CASTER_NAMES, formatGameTime, type CommentaryLine } from '../../game/match/commentary'
import type { MatchEvent } from '../../game/match/types'
import { eventIcon, SIDE_BORDER } from './matchStyles'

interface EventFeedProps {
  events: readonly MatchEvent[]
  lines: readonly CommentaryLine[]
  /** How many events have happened so far. */
  shown: number
}

/** Play-by-play, newest on top. Big moments get a bigger card. */
export function EventFeed({ events, lines, shown }: EventFeedProps) {
  const entries = events.slice(0, shown).map((event, index) => ({ event, line: lines[index], index })).reverse()

  return (
    <ol aria-live="polite" className="flex flex-col gap-2">
      {entries.length === 0 && (
        <li className="rounded-lg border border-gold/20 bg-abyss/60 p-3 text-sm text-gold-light/60 italic">
          Minions are spawning. The casters are pretending to have notes.
        </li>
      )}
      {entries.map(({ event, line, index }) => (
        <motion.li
          key={index}
          layout
          initial={{ opacity: 0, y: -12, scale: event.big ? 1.06 : 1 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className={`flex gap-3 rounded-lg border-l-4 bg-abyss/70 p-3 ${SIDE_BORDER[event.side]} ${
            event.big ? 'border border-l-4 border-gold/50 shadow-lg shadow-gold/10' : ''
          }`}
        >
          <span className={event.big ? 'text-2xl' : 'text-lg'} aria-hidden="true">
            {eventIcon(event)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] tracking-wider text-gold/70 uppercase">
              <span className="font-mono">{formatGameTime(event.time)}</span> · {line ? CASTER_NAMES[line.caster] : ''}
            </p>
            <p className={event.big ? 'text-base font-bold text-gold' : 'text-sm text-gold-light/90'}>
              {line?.text}
            </p>
          </div>
        </motion.li>
      ))}
    </ol>
  )
}
