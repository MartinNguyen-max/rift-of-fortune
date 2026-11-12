import { motion, useReducedMotion } from 'framer-motion'
import { useEffect } from 'react'
import { championIconUrl, championSplashUrl, gameData } from '../data'
import type { Champion } from '../data/types'
import { prepareChampionVoice } from '../services/sound'
import { useSpin } from './useSpin'

const SPIN_FRAMES = 15
const spinDelayMs = (frame: number) => 25 + frame * frame * 0.6
const iconUrl = (champion: Champion) => championIconUrl(champion.image)
/** How long the spin takes before it lands. */
const SPIN_MS = Array.from({ length: SPIN_FRAMES }, (_, frame) => spinDelayMs(frame)).reduce((sum, delay) => sum + delay, 0)
/** The voice line starts this long before the champion lands, so they hit together. */
const VOICE_LEAD_MS = 250

interface ChampionRollProps {
  champion: Champion
  onRevealed: () => void
}

/** Cycles through random champion icons, slowing down, then lands on `champion`. */
export function ChampionRoll({ champion, onRevealed }: ChampionRollProps) {
  const reduceMotion = useReducedMotion() === true

  useEffect(() => {
    const playVoice = prepareChampionVoice(champion.id)
    const timer = setTimeout(playVoice, reduceMotion ? 0 : Math.max(0, SPIN_MS - VOICE_LEAD_MS))
    return () => clearTimeout(timer)
  }, [champion, reduceMotion])

  const { frame } = useSpin({
    target: champion,
    pool: gameData.champions,
    spinFrames: SPIN_FRAMES,
    delayMs: spinDelayMs,
    imageUrl: iconUrl,
    onLanded: onRevealed,
  })

  useEffect(() => {
    new Image().src = championSplashUrl(champion.id)
  }, [champion])

  return (
    <div className="flex flex-col items-center gap-2 lg:gap-3">
      <div className="relative size-20 overflow-hidden rounded-xl border-2 border-hextech lg:size-28 shadow-lg shadow-hextech/30">
        {frame && (
          <motion.img
            key={frame.id}
            src={championIconUrl(frame.image)}
            alt=""
            className="size-full object-cover"
            initial={{ y: -24, opacity: 0.4 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.08 }}
          />
        )}
      </div>
      <p className="h-6 text-lg font-semibold text-gold-light/70">{frame?.name ?? '...'}</p>
    </div>
  )
}
