import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { summonersRiftMapUrl } from '../../data'
import type { MatchEvent } from '../../game/match/types'
import { eventIcon, SIDE_BG, SPOT_POSITIONS } from './matchStyles'

/** How many recent events stay on the map, fading out. */
const TRAIL = 3

/** The minimap with markers where the latest events happened. `overlay` covers it, e.g. with a fight scene. */
export function MatchMap({ events, overlay }: { events: readonly MatchEvent[]; overlay?: ReactNode }) {
  const recent = events.slice(-TRAIL)

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-gold/40 shadow-2xl shadow-black">
      <img src={summonersRiftMapUrl} alt="Summoner's Rift" className="absolute inset-0 size-full object-cover opacity-60" />
      <AnimatePresence>
        {recent.map((event, index) => {
          const { x, y } = SPOT_POSITIONS[event.spot]
          const latest = index === recent.length - 1
          return (
            <motion.div
              key={`${event.time}-${event.kind}-${events.length - recent.length + index}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: latest ? 1 : 0.7, opacity: latest ? 1 : 0.35 }}
              exit={{ opacity: 0 }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {latest && (
                <span className={`absolute inset-0 animate-ping rounded-full opacity-60 ${SIDE_BG[event.side]}`} />
              )}
              <span
                className={`relative flex size-8 items-center justify-center rounded-full border-2 border-abyss text-base shadow-lg ${SIDE_BG[event.side]}`}
              >
                {eventIcon(event)}
              </span>
            </motion.div>
          )
        })}
      </AnimatePresence>
      <AnimatePresence>{overlay}</AnimatePresence>
    </div>
  )
}
