import { AnimatePresence, motion } from 'framer-motion'
import { formatWinChance } from '../../game/match/winChance'
import { barShare, swingOf, wobbleOf } from './winChanceLook'

interface WinChanceBarProps {
  /** Blue's win chance before the match and after each event shown so far. */
  history: readonly number[]
}

const WIDTH = 300
const HEIGHT = 40
/** From this chance on, the leader's side starts to burn: the win is close. */
const ALMOST = 0.85

/**
 * Who is winning right now, as a wild tug-of-war: the bar overshoots on every swing, wobbles like
 * a coin in the air (most when it's close), shows the swing, and burns when a win is near. The
 * numbers stay honest, so the favourite is always clear.
 */
export function WinChanceBar({ history }: WinChanceBarProps) {
  const chance = history[history.length - 1] ?? 0.5
  const { blue, red } = formatWinChance(chance)
  const share = barShare(chance)
  const wobble = wobbleOf(chance)
  const swing = swingOf(history)
  const leader = chance >= 0.5 ? 'blue' : 'red'
  const almost = Math.max(chance, 1 - chance) >= ALMOST && chance > 0 && chance < 1
  const points = history
    .map((value, index) => {
      const x = history.length > 1 ? (index / (history.length - 1)) * WIDTH : WIDTH
      return `${x.toFixed(1)},${((1 - value) * HEIGHT).toFixed(1)}`
    })
    .join(' ')

  return (
    <figure className="relative rounded-xl border border-gold/30 bg-abyss/70 p-3">
      <figcaption className="mb-1.5 flex items-end justify-between">
        <Percent value={blue} leading={leader === 'blue'} className="text-hextech" />
        <span className="pb-1 text-[10px] tracking-widest text-gold/70 uppercase">Win chance</span>
        <Percent value={red} leading={leader === 'red'} className="text-red-400" />
      </figcaption>
      <div className="relative">
        <div
          className={`relative h-6 overflow-hidden rounded-full bg-linear-to-b from-red-400 to-red-700 ${
            almost ? (leader === 'blue' ? 'shadow-[0_0_18px_rgb(10_200_185/0.7)]' : 'shadow-[0_0_18px_rgb(248_113_113/0.7)]') : ''
          }`}
          role="meter"
          aria-label="Your team's chance to win"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={blue}
        >
          <motion.div
            className="absolute inset-y-0 left-0 origin-left bg-linear-to-b from-cyan-300 to-hextech"
            initial={false}
            animate={{ width: `${share * 100}%` }}
            transition={{ type: 'spring', stiffness: 320, damping: 7, mass: 0.8 }}
          >
            {/* The coin in the air: the edge never sits still. */}
            <motion.span
              className="absolute inset-y-0 -right-1 w-2 bg-gold-light shadow-[0_0_10px_rgb(240_230_210)]"
              animate={{ x: [0, wobble, -wobble, wobble * 0.6, -wobble * 0.8, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
          <span className="absolute inset-y-0 left-1/2 w-px bg-abyss/60" />
          {almost && <Flames side={leader} />}
        </div>
        <AnimatePresence>
          {swing && (
            <motion.span
              key={history.length}
              initial={{ y: 4, opacity: 0, scale: 0.6 }}
              animate={{ y: -18, opacity: [0, 1, 1, 0], scale: 1.2 }}
              transition={{ duration: 1.4 }}
              className={`pointer-events-none absolute -top-2 font-display text-lg font-black drop-shadow-[0_2px_4px_black] ${
                swing.side === 'blue' ? 'left-4 text-hextech' : 'right-4 text-red-400'
              }`}
            >
              +{swing.points}%
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {almost && (
          <motion.p
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [1, 1.08, 1], opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ scale: { duration: 0.8, repeat: Infinity } }}
            className={`mt-1 text-center font-display text-xs font-black tracking-widest uppercase ${
              leader === 'blue' ? 'text-hextech' : 'text-red-400'
            }`}
          >
            {Math.max(blue, red) >= 95 ? 'GG incoming' : 'Closing in'}
          </motion.p>
        )}
      </AnimatePresence>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-2 h-8 w-full" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="0" width={WIDTH} height={HEIGHT / 2} className="fill-hextech/10" />
        <rect x="0" y={HEIGHT / 2} width={WIDTH} height={HEIGHT / 2} className="fill-red-400/10" />
        <line x1="0" x2={WIDTH} y1={HEIGHT / 2} y2={HEIGHT / 2} className="stroke-gold/30" strokeDasharray="4 4" />
        <polyline points={points} fill="none" className="stroke-gold" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </figure>
  )
}

function Percent({ value, leading, className }: { value: number; leading: boolean; className: string }) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 1.8, rotate: leading ? -6 : 6 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 10 }}
      className={`font-display leading-none font-black tabular-nums ${leading ? 'text-3xl' : 'text-xl opacity-80'} ${className}`}
    >
      {value}%
    </motion.span>
  )
}

/** Little flames licking along the leader's side of the bar. */
function Flames({ side }: { side: 'blue' | 'red' }) {
  return (
    <div className={`pointer-events-none absolute inset-y-0 flex w-1/2 items-end justify-around ${side === 'blue' ? 'left-0' : 'right-0'}`} aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <motion.span
          key={index}
          className="text-xs"
          animate={{ y: [2, -3, 2], opacity: [0.5, 1, 0.5], scale: [0.8, 1.15, 0.8] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: index * 0.17 }}
        >
          🔥
        </motion.span>
      ))}
    </div>
  )
}
