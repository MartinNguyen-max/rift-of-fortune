import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { championIconUrl, championSplashUrl, gameData } from '../data'
import type { Champion } from '../data/types'
import { useSpin } from './useSpin'

const SPIN_FRAMES = 20
const spinDelayMs = (frame: number) => 35 + frame * frame * 0.6
const iconUrl = (champion: Champion) => championIconUrl(champion.image)

interface ChampionRollProps {
  champion: Champion
  onRevealed: () => void
}

/** Cycles through random champion icons, slowing down, then lands on `champion`. */
export function ChampionRoll({ champion, onRevealed }: ChampionRollProps) {
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
