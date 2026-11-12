import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { markerAt, ULT, ultBar, ultScore } from '../../../game/multiplayer/ult'
import { GetReady } from './GetReady'
import { usePressKey, useStopwatch } from './useStopwatch'

interface UltGameProps {
  seed: number
  onScore: (score: number) => void
}

/** The teamfight: stop the racing marker inside the zone to land your ult. Dead center is 100. */
export function UltGame({ seed, onScore }: UltGameProps) {
  const bar = useMemo(() => ultBar(seed), [seed])
  const [phase, setPhase] = useState<'ready' | 'aiming' | 'done'>('ready')
  const [stoppedAt, setStoppedAt] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const { seconds, read } = useStopwatch(phase === 'aiming')

  const finish = useCallback(
    (at: number | null) => {
      const points = ultScore(bar, at)
      setStoppedAt(at)
      setScore(points)
      setPhase('done')
      onScore(points)
    },
    [bar, onScore],
  )

  const press = useCallback(() => {
    if (phase === 'aiming') finish(read())
  }, [phase, read, finish])
  usePressKey(press, phase === 'aiming')

  // Out of time: the ult never went off.
  useEffect(() => {
    if (phase !== 'aiming') return
    const id = window.setTimeout(() => finish(null), ULT.seconds * 1000)
    return () => window.clearTimeout(id)
  }, [phase, finish])

  const start = useCallback(() => setPhase('aiming'), [])
  const position = phase === 'done' ? (stoppedAt === null ? null : markerAt(bar, stoppedAt)) : markerAt(bar, phase === 'aiming' ? seconds : 0)
  const timeLeft = Math.max(0, ULT.seconds - seconds)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <h2 className="font-display text-2xl font-black text-gold">Teamfight! Land your ult</h2>
        <p className="text-sm text-gold-light/70">Stop the marker in the gold zone. It only gets faster.</p>
      </div>

      <div className="w-full">
        <div className="relative h-12 overflow-hidden rounded-md border-2 border-gold/60 bg-abyss">
          <div
            className="absolute inset-y-0 bg-gold/40"
            style={{ left: `${(bar.zoneCenter - ULT.zoneHalfWidth) * 100}%`, width: `${ULT.zoneHalfWidth * 200}%` }}
          />
          <div className="absolute inset-y-0 w-0.5 bg-gold" style={{ left: `${bar.zoneCenter * 100}%` }} />
          {position !== null && (
            <div
              className="absolute inset-y-0 w-1.5 -translate-x-1/2 bg-hextech shadow-[0_0_12px_rgb(10_200_185)]"
              style={{ left: `${position * 100}%` }}
            />
          )}
        </div>
        {phase === 'aiming' && (
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-abyss/80">
            <div className="h-full bg-red-400" style={{ width: `${(timeLeft / ULT.seconds) * 100}%` }} />
          </div>
        )}
      </div>

      {phase === 'ready' && <GetReady onGo={start} />}
      {phase === 'aiming' && (
        <motion.button
          type="button"
          onClick={press}
          whileTap={{ scale: 0.9 }}
          className="size-28 rounded-full border-4 border-hextech bg-linear-to-b from-cyan-400 to-blue-700 font-display text-2xl font-black text-white shadow-lg shadow-cyan-500/40"
        >
          ULT
        </motion.button>
      )}
      {phase === 'done' && (
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
          <p className={`font-display text-5xl font-black ${score >= 60 ? 'text-gold' : 'text-red-400'}`}>{score}</p>
          <p className="text-gold-light/80">
            {stoppedAt === null ? 'Too slow, the fight started without you.' : score >= 90 ? 'Perfect ult!' : score >= 60 ? 'Ult landed!' : 'Missed!'}
          </p>
        </motion.div>
      )}
    </div>
  )
}
