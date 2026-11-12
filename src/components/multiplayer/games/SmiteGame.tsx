import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { mapIconUrl } from '../../../data'
import { hpAt, SMITE_PROFILES, smiteDuel, smiteResult, type SmiteResult, type SmiteTarget } from '../../../game/multiplayer/smite'
import { GetReady } from './GetReady'
import { usePressKey, useStopwatch } from './useStopwatch'

interface SmiteGameProps {
  target: SmiteTarget
  seed: number
  onScore: (score: number) => void
}

const NAMES: Record<SmiteTarget, string> = { baron: 'Baron Nashor', elder: 'Elder Dragon' }

const formatHp = (hp: number) => Math.round(hp).toLocaleString('en-US')

/**
 * The smite duel: the objective's health drops in random hits (the same hits for both players).
 * Smite once it is in smite range; the lower the health, the more points, but wait too long and
 * it dies before you smite.
 */
export function SmiteGame({ target, seed, onScore }: SmiteGameProps) {
  const duel = useMemo(() => smiteDuel(target, seed), [target, seed])
  const { maxHp } = SMITE_PROFILES[target]
  const [phase, setPhase] = useState<'ready' | 'duel' | 'done'>('ready')
  const [result, setResult] = useState<SmiteResult | null>(null)
  const { seconds, read } = useStopwatch(phase === 'duel')

  const finish = useCallback(
    (outcome: SmiteResult) => {
      setResult(outcome)
      setPhase('done')
      onScore(outcome.score)
    },
    [onScore],
  )

  const smite = useCallback(() => {
    if (phase === 'duel') finish(smiteResult(duel, read()))
  }, [phase, duel, read, finish])
  usePressKey(smite, phase === 'duel')

  // Never smited: the objective dies on its own.
  useEffect(() => {
    if (phase !== 'duel') return
    const id = window.setTimeout(() => finish(smiteResult(duel, null)), duel.deathAt * 1000)
    return () => window.clearTimeout(id)
  }, [phase, duel, finish])

  const start = useCallback(() => setPhase('duel'), [])
  const hp = phase === 'ready' ? 1 : phase === 'done' && result?.outcome !== 'late' ? (result?.hp ?? 0) / maxHp : hpAt(duel, seconds)
  const inRange = hp <= duel.threshold

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <img src={mapIconUrl(target)} alt="" className="size-12 object-contain" />
        <h2 className="font-display text-2xl font-black text-gold">{NAMES[target]}</h2>
      </div>

      <div className="w-full">
        <p
          className={`mb-1 text-center font-display text-lg font-black uppercase ${
            phase === 'duel' && inRange ? 'animate-pulse text-amber-300' : 'text-transparent'
          }`}
          aria-live="polite"
        >
          {phase === 'duel' && inRange ? 'In smite range!' : '.'}
        </p>
        <div className="relative h-10 overflow-hidden rounded-md border-2 border-gold/60 bg-abyss">
          <motion.div
            className={`absolute inset-y-0 left-0 ${inRange ? 'bg-amber-400' : 'bg-purple-600'}`}
            animate={{ width: `${hp * 100}%` }}
            transition={{ duration: 0.08 }}
          />
          <div
            className="absolute inset-y-0 left-0 border-r-2 border-dashed border-gold bg-gold/15"
            style={{ width: `${duel.threshold * 100}%` }}
            aria-hidden="true"
          />
          <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold text-white drop-shadow">
            {formatHp(hp * maxHp)} / {formatHp(maxHp)}
          </span>
        </div>
        <p className="mt-1 flex justify-between text-xs text-gold/80">
          <span>← Smite range ({formatHp(SMITE_PROFILES[target].smiteDamage)})</span>
          <span>Lower = more points</span>
        </p>
      </div>

      {phase === 'ready' && <GetReady onGo={start} />}
      {phase === 'duel' && (
        <motion.button
          type="button"
          onClick={smite}
          whileTap={{ scale: 0.9 }}
          className="size-28 rounded-full border-4 border-amber-300 bg-linear-to-b from-amber-400 to-orange-600 font-display text-2xl font-black text-abyss shadow-lg shadow-amber-500/40"
        >
          SMITE
        </motion.button>
      )}
      {phase === 'done' && result && <SmiteVerdict result={result} />}
    </div>
  )
}

function SmiteVerdict({ result }: { result: SmiteResult }) {
  const text =
    result.outcome === 'early'
      ? `Too early! Smite hit at ${formatHp(result.hp)} health.`
      : result.outcome === 'late'
        ? 'Too late. It died before your smite.'
        : `Smite at ${formatHp(result.hp)} health!`
  return (
    <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
      <p className={`font-display text-5xl font-black ${result.score > 0 ? 'text-gold' : 'text-red-400'}`}>{result.score}</p>
      <p className="text-gold-light/80">{text}</p>
    </motion.div>
  )
}
