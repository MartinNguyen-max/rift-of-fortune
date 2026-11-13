import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { Finisher } from '../../game/finishers'
import { finisherUrl } from '../../game/finishers'
import { getSoundSettings, VOICE_VOLUME } from '../../services/sound'
import { BigCall } from './parts'

/** Never wait longer than this for a clip, even if it hangs. */
const MAX_CLIP_MS = 16_000
/** A clip that hasn't loaded by now (slow network) is skipped. */
const MAX_LOAD_MS = 4000

interface FinisherVideoProps {
  finisher: Finisher
  won: boolean
  /** The clip ended, failed to load (not added yet) or was skipped. */
  onDone: () => void
}

/**
 * After a mini-game, like Mortal Kombat: the winner's finisher animation plays to the end with a
 * huge WON or LOST above it. Plays with sound when sound effects are on and the browser allows it.
 */
export function FinisherVideo({ finisher, won, onDone }: FinisherVideoProps) {
  const video = useRef<HTMLVideoElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (loaded) return
    const id = window.setTimeout(onDone, MAX_LOAD_MS)
    return () => window.clearTimeout(id)
  }, [loaded, onDone])

  useEffect(() => {
    const element = video.current
    if (!element) return
    element.volume = VOICE_VOLUME
    element.muted = !getSoundSettings().effects
    element.play().catch(() => {
      // Sound before a tap is blocked on some browsers: play it muted instead.
      element.muted = true
      element.play().catch(onDone)
    })
    const id = window.setTimeout(onDone, MAX_CLIP_MS)
    return () => window.clearTimeout(id)
  }, [onDone])

  return (
    // Hidden until the clip has loaded, so a clip that isn't there yet never flashes an empty box.
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: loaded ? 1 : 0 }} className="flex flex-col items-center gap-3 py-1">
      {loaded && <BigCall text={won ? 'WON' : 'LOST'} tone={won ? 'win' : 'lose'} />}
      <div className="relative w-full overflow-hidden rounded-xl border-2 border-gold/50 bg-black shadow-2xl shadow-black">
        <video
          ref={video}
          src={finisherUrl(finisher, import.meta.env.BASE_URL)}
          playsInline
          preload="auto"
          onLoadedData={() => setLoaded(true)}
          onEnded={onDone}
          onError={onDone}
          className="aspect-video w-full object-contain"
          aria-label={finisher.title}
        />
        <button
          type="button"
          onClick={onDone}
          className="absolute right-2 bottom-2 rounded-md bg-abyss/80 px-3 py-1 text-sm font-semibold text-gold-light/90 transition hover:text-gold"
        >
          Skip ▸
        </button>
      </div>
    </motion.div>
  )
}
