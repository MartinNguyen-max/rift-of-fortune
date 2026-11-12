import { motion } from 'framer-motion'
import { formatWinChance } from '../../game/match/winChance'

interface WinChanceBarProps {
  /** Blue's win chance before the match and after each event shown so far. */
  history: readonly number[]
}

const WIDTH = 300
const HEIGHT = 40

/** Who is winning right now, as a tug-of-war bar, with a small line of how it swung. */
export function WinChanceBar({ history }: WinChanceBarProps) {
  const chance = history[history.length - 1] ?? 0.5
  const { blue, red } = formatWinChance(chance)
  const points = history
    .map((value, index) => {
      const x = history.length > 1 ? (index / (history.length - 1)) * WIDTH : WIDTH
      return `${x.toFixed(1)},${((1 - value) * HEIGHT).toFixed(1)}`
    })
    .join(' ')

  return (
    <figure className="rounded-xl border border-gold/30 bg-abyss/70 p-3">
      <figcaption className="mb-1.5 flex items-end justify-between">
        <Percent value={blue} className="text-hextech" />
        <span className="pb-1 text-[10px] tracking-widest text-gold/70 uppercase">Win chance</span>
        <Percent value={red} className="text-red-400" />
      </figcaption>
      <div
        className="relative h-4 overflow-hidden rounded-full bg-red-500/80"
        role="meter"
        aria-label="Your team's chance to win"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={blue}
      >
        <motion.div
          className="absolute inset-y-0 left-0 bg-hextech"
          initial={false}
          animate={{ width: `${blue}%` }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        />
        <span className="absolute inset-y-0 left-1/2 w-px bg-abyss/60" />
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-2 h-8 w-full" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="0" width={WIDTH} height={HEIGHT / 2} className="fill-hextech/10" />
        <rect x="0" y={HEIGHT / 2} width={WIDTH} height={HEIGHT / 2} className="fill-red-400/10" />
        <line x1="0" x2={WIDTH} y1={HEIGHT / 2} y2={HEIGHT / 2} className="stroke-gold/30" strokeDasharray="4 4" />
        <polyline points={points} fill="none" className="stroke-gold" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </figure>
  )
}

function Percent({ value, className }: { value: number; className: string }) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 1.3 }}
      animate={{ scale: 1 }}
      className={`font-display text-2xl leading-none font-black tabular-nums ${className}`}
    >
      {value}%
    </motion.span>
  )
}
