import { motion } from 'framer-motion'
import { useEffect } from 'react'
import type { MiniGameInfo } from '../../game/minigames/catalog'
import { TIMINGS } from '../../game/multiplayer/session'
import { playSound } from '../../services/sound'
import { openingArt } from './gameOpening'
import type { Contestant } from './types'

interface GameOpeningProps {
  info: MiniGameInfo
  you: Contestant
  them: Contestant
  onDone: () => void
}

const OPENING_MS = TIMINGS.opening * 1000

/**
 * The face-off before every mini-game, like the versus screen before a match: both champions
 * slide in, VS slams down, the game's name, then the game. Tap to skip.
 */
export function GameOpening({ info, you, them, onDone }: GameOpeningProps) {
  const art = openingArt(info.id, you.champion, them.champion)

  useEffect(() => {
    playSound('lock-in')
    const id = window.setTimeout(onDone, OPENING_MS)
    return () => window.clearTimeout(id)
  }, [onDone])

  return (
    <motion.button
      type="button"
      onClick={onDone}
      aria-label={`${info.name}: ${you.name} versus ${them.name}. Tap to start`}
      exit={{ opacity: 0 }}
      className="relative block h-72 w-full overflow-hidden rounded-lg border-2 border-gold/50 bg-abyss sm:h-80"
    >
      <Side src={art.you} name={you.name} side="left" mirror={false} />
      <Side src={art.them} name={them.name} side="right" mirror={art.mirror} />
      <motion.span
        initial={{ scale: 3.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.35, type: 'spring', stiffness: 260, damping: 13 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-6xl font-black text-gold drop-shadow-[0_0_18px_rgba(0,0,0,0.9)] sm:text-7xl"
        aria-hidden="true"
      >
        VS
      </motion.span>
      <motion.span
        initial={{ opacity: 0, scale: 1.6 }}
        animate={{ opacity: [0, 0.9, 0] }}
        transition={{ delay: 0.4, duration: 0.45 }}
        className="pointer-events-none absolute inset-0 bg-gold-light/40"
        aria-hidden="true"
      />
      <motion.p
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.75 }}
        className="absolute inset-x-2 bottom-3 rounded-md bg-abyss/80 px-3 py-1.5 text-center font-display text-lg leading-tight font-black text-gold-light [overflow-wrap:anywhere] sm:text-xl"
        aria-hidden="true"
      >
        {info.name}
      </motion.p>
    </motion.button>
  )
}

interface SideProps {
  src: string
  name: string
  side: 'left' | 'right'
  mirror: boolean
}

/** One champion's half, sliding in from their edge with a slanted cut toward the middle. */
function Side({ src, name, side, mirror }: SideProps) {
  const left = side === 'left'
  return (
    <motion.div
      initial={{ x: left ? '-100%' : '100%' }}
      animate={{ x: 0 }}
      transition={{ type: 'spring', stiffness: 170, damping: 20 }}
      className={`absolute inset-y-0 w-[56%] ${left ? 'left-0' : 'right-0'}`}
      style={{ clipPath: left ? 'polygon(0 0, 100% 0, 82% 100%, 0 100%)' : 'polygon(18% 0, 100% 0, 100% 100%, 0 100%)' }}
      aria-hidden="true"
    >
      <img src={src} alt="" className={`size-full object-cover object-[50%_15%] ${mirror ? '-scale-x-100' : ''}`} draggable={false} />
      <div className={`absolute inset-0 bg-linear-to-t ${left ? 'from-hextech/50' : 'from-red-600/50'} via-transparent to-transparent`} />
      <span
        className={`absolute top-2 max-w-[80%] truncate rounded px-2 py-0.5 font-display text-sm font-black text-white ${
          left ? 'left-2 bg-hextech/70' : 'right-2 bg-red-600/70'
        }`}
      >
        {name}
      </span>
    </motion.div>
  )
}
