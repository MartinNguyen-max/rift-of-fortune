import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { championIconUrl, championSplashUrl, gameData } from '../data'
import type { Champion } from '../data/types'
import { sample } from '../game/random'

const SPIN_FRAMES = 24
const spinDelayMs = (frame: number) => 40 + frame * frame * 0.6

interface ChampionRollProps {
  champion: Champion
  onRevealed: () => void
}

/** Cycles through random champion icons, slowing down, then lands on `champion`. */
export function ChampionRoll({ champion, onRevealed }: ChampionRollProps) {
  const [frame, setFrame] = useState<Champion | null>(null)

  const reduceMotion = useReducedMotion() === true

  useEffect(() => {
    const spinFrames = reduceMotion ? 0 : SPIN_FRAMES
    const frames = [...sample(gameData.champions, spinFrames), champion]
    for (const { image } of frames) new Image().src = championIconUrl(image)
    new Image().src = championSplashUrl(champion.id)

    let index = 0
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const next = frames[index]
      if (!next) return
      setFrame(next)
      if (index === frames.length - 1) {
        onRevealed()
        return
      }
      timer = setTimeout(tick, spinDelayMs(index))
      index++
    }
    timer = setTimeout(tick, 0)
    return () => clearTimeout(timer)
  }, [champion, onRevealed, reduceMotion])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative size-28 overflow-hidden rounded-xl border-2 border-hextech shadow-lg shadow-hextech/30">
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
