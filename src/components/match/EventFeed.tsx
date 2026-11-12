import { motion } from 'framer-motion'
import { CASTER_NAMES, describeEvent, formatGameTime, type MatchLines } from '../../game/match/commentary'
import type { MatchEvent, MatchTeams } from '../../game/match/types'
import { eventIcon, SIDE_BORDER } from './matchStyles'

interface EventFeedProps {
  events: readonly MatchEvent[]
  lines: MatchLines
  teams: MatchTeams
  /** How many events have happened so far. */
  shown: number
  /** Only the newest entries, or every entry when left out. */
  limit?: number
}

/** Kill feed, newest on top. Small events get one plain row, big moments a card with the caster's line. */
export function EventFeed({ events, lines, teams, shown, limit }: EventFeedProps) {
  const entries = events
    .slice(0, shown)
    .map((event, index) => ({ event, line: lines[index] ?? null, index }))
    .reverse()
    .slice(0, limit)

  return (
    <ol aria-live="polite" className="flex flex-col gap-1.5">
      {entries.length === 0 && (
        <li className="rounded-lg border border-gold/20 bg-abyss/60 p-2 text-sm text-gold-light/60 italic">Minions are spawning…</li>
      )}
      {entries.map(({ event, line, index }) => (
        <motion.li
          key={index}
          layout
          initial={{ opacity: 0, y: -10, scale: event.big ? 1.08 : 1 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className={`rounded-lg border-l-4 bg-abyss/70 ${SIDE_BORDER[event.side]} ${
            event.big ? 'border border-l-4 border-gold/50 p-2.5 shadow-lg shadow-gold/10' : 'px-2 py-1.5'
          }`}
        >
          <p className="flex items-center gap-2 text-sm text-gold-light/90">
            <span aria-hidden="true" className={event.big ? 'text-xl' : ''}>
              {eventIcon(event)}
            </span>
            <span className={`min-w-0 flex-1 ${event.big ? 'font-bold text-gold' : line ? '' : 'truncate'}`}>
              {line && !line.callback ? line.text : describeEvent(event, teams)}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-gold/60">{formatGameTime(event.time)}</span>
          </p>
          {line && (
            <p className="mt-0.5 text-[11px] text-gold/70">
              {line.callback ? (
                <span className="italic">
                  {CASTER_NAMES[line.caster]}: “{line.text}”
                </span>
              ) : (
                `— ${CASTER_NAMES[line.caster]}`
              )}
            </p>
          )}
        </motion.li>
      ))}
    </ol>
  )
}
