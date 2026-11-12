import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { mapIconUrl } from '../../data'
import type { LiveEventKind } from '../../game/match/types'
import { TIMINGS } from '../../game/multiplayer/session'

interface EventIntroProps {
  kind: LiveEventKind
  /** Only for the gank: are you the one hiding? */
  amGanker: boolean
  onDone: () => void
}

interface IntroText {
  title: string
  /** One short line: what to do. */
  task: string
}

function introText(kind: LiveEventKind, amGanker: boolean): IntroText {
  switch (kind) {
    case 'gank':
      return amGanker
        ? { title: 'You are ganking!', task: 'Hide in ONE bush. The enemy will guess where.' }
        : { title: 'Enemy is ganking!', task: 'Guess which bush they hide in.' }
    case 'teamfight':
      return { title: 'Big teamfight!', task: 'Press ULT when the marker is in the gold zone.' }
    case 'baron':
      return { title: 'Baron fight!', task: 'Smite when its health is LOW. Wait too long and it dies.' }
    case 'elder':
      return { title: 'Elder Dragon!', task: 'Like Baron, but faster. Smite as low as you dare.' }
  }
}

const ICONS: Record<LiveEventKind, string | null> = { gank: null, teamfight: null, baron: 'baron', elder: 'elder' }
const EMOJI: Record<LiveEventKind, string> = { gank: '🗡️', teamfight: '💥', baron: '', elder: '' }

/** "Get ready!" before a mini-game: what is happening and what to do, in one line, with time to read it. */
export function EventIntro({ kind, amGanker, onDone }: EventIntroProps) {
  const { title, task } = introText(kind, amGanker)
  const icon = ICONS[kind]

  useEffect(() => {
    const id = window.setTimeout(onDone, TIMINGS.intro * 1000)
    return () => window.clearTimeout(id)
  }, [onDone])

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <motion.div
        initial={{ scale: 0.3, rotate: -15, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 12 }}
      >
        {icon === 'baron' || icon === 'elder' ? (
          <img src={mapIconUrl(icon)} alt="" className="size-20 object-contain" />
        ) : (
          <span aria-hidden="true" className="text-6xl">
            {EMOJI[kind]}
          </span>
        )}
      </motion.div>
      <h2 className="font-display text-3xl font-black text-gold uppercase sm:text-4xl">{title}</h2>
      <p className="text-lg font-semibold text-gold-light">{task}</p>
      <div className="w-full">
        <p className="mb-1 text-xs tracking-[0.3em] text-hextech uppercase">Get ready</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-abyss/80">
          <motion.div
            className="h-full bg-hextech"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: TIMINGS.intro, ease: 'linear' }}
          />
        </div>
      </div>
    </div>
  )
}
