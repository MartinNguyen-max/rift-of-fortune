import type { MatchEvent } from '../../game/match/types'
import { formatGold } from './matchStyles'

interface GoldGraphProps {
  /** The events shown so far. */
  events: readonly MatchEvent[]
  clock: number
  /** Gold difference at the clock (blue minus red), so the line reaches "now". */
  currentDiff: number
}

const WIDTH = 300
const HEIGHT = 80
/** The x axis covers at least this much game time and grows after it. */
const MIN_SPAN = 25 * 60
/** The y axis covers at least ±this much gold. */
const MIN_GOLD = 3000

/** Gold lead over time. Above the middle line, the player's team is ahead. */
export function GoldGraph({ events, clock, currentDiff }: GoldGraphProps) {
  const points = [
    { time: 0, diff: 0 },
    ...events.map(({ time, score }) => ({ time, diff: score.blue.gold - score.red.gold })),
    { time: clock, diff: currentDiff },
  ]
  const span = Math.max(MIN_SPAN, clock)
  const range = Math.max(MIN_GOLD, ...points.map(({ diff }) => Math.abs(diff)))
  const x = (time: number) => (time / span) * WIDTH
  const y = (diff: number) => HEIGHT / 2 - (diff / range) * (HEIGHT / 2 - 4)
  const path = points.map(({ time, diff }) => `${x(time).toFixed(1)},${y(diff).toFixed(1)}`).join(' ')
  const leader = currentDiff >= 0 ? 'text-hextech' : 'text-red-400'

  return (
    <figure className="rounded-xl border border-gold/20 bg-abyss/60 p-2">
      <figcaption className="mb-1 flex justify-between text-[10px] tracking-widest text-gold/70 uppercase">
        <span>Gold lead</span>
        <span className={`font-mono font-bold ${leader}`}>
          {currentDiff === 0 ? 'Even' : `${currentDiff > 0 ? 'You +' : 'Bot +'}${formatGold(Math.abs(currentDiff))}`}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-16 w-full" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="0" width={WIDTH} height={HEIGHT / 2} className="fill-hextech/5" />
        <rect x="0" y={HEIGHT / 2} width={WIDTH} height={HEIGHT / 2} className="fill-red-400/5" />
        <line x1="0" x2={WIDTH} y1={HEIGHT / 2} y2={HEIGHT / 2} className="stroke-gold/30" strokeDasharray="4 4" />
        <polyline points={path} fill="none" className="stroke-gold" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </figure>
  )
}
