import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { summonersRiftMapUrl } from '../../data'
import { LANE_NAMES, LANE_SPOTS, LANES, type Lane, type MapPoint } from '../../game/minigames/riftLanes'
import { placeAt } from './laneScreen'
import { championIconById } from './miniGameArt'

interface LaneMapProps {
  /** Lights out: the map is almost black (Paranoia). */
  dark?: boolean
  /** Tapping a lane, while a choice is open. */
  onPick: ((lane: Lane) => void) | null
  /** What a tap does, for screen readers: "Guard", "Gate to"... */
  pickVerb: string
  /** A gold or red frame for a won or lost round. */
  frame?: 'win' | 'lose' | null
  /** Tokens, cards and calls drawn over the map, placed with `placeAt`. */
  children?: ReactNode
}

/** The minimap with its three lanes as big round spots to tap: top corner, mid, bot corner. */
export function LaneMap({ dark = false, onPick, pickVerb, frame = null, children }: LaneMapProps) {
  const border = frame === 'win' ? 'border-gold' : frame === 'lose' ? 'border-red-500' : 'border-gold/40'
  return (
    <div className={`relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl border-2 bg-black select-none ${border}`}>
      <motion.img
        src={summonersRiftMapUrl}
        alt=""
        draggable={false}
        animate={{ filter: dark ? 'brightness(0.16) saturate(0.4)' : 'brightness(0.8) saturate(1)' }}
        transition={{ duration: 0.9 }}
        className="absolute inset-0 size-full object-cover"
      />
      {dark && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,transparent_35%,rgb(0_0_0/0.7)_100%)]" />}
      {LANES.map((lane) => (
        <LaneSpot key={lane} lane={lane} dark={dark} onPick={onPick} pickVerb={pickVerb} />
      ))}
      {children}
    </div>
  )
}

function LaneSpot({ lane, dark, onPick, pickVerb }: { lane: Lane; dark: boolean; onPick: ((lane: Lane) => void) | null; pickVerb: string }) {
  const open = onPick !== null
  return (
    <button
      type="button"
      disabled={!open}
      onClick={() => onPick?.(lane)}
      aria-label={`${pickVerb} ${LANE_NAMES[lane]} lane`}
      style={placeAt(LANE_SPOTS[lane])}
      className={`absolute flex size-[26%] -translate-x-1/2 -translate-y-1/2 items-end justify-center rounded-full border-2 pb-[3%] transition ${
        open
          ? 'cursor-pointer border-hextech/80 bg-hextech/10 shadow-[0_0_18px_rgb(10_200_185/0.45)] hover:bg-hextech/25 active:scale-95'
          : dark
            ? 'border-gold/15 bg-transparent'
            : 'border-gold/35 bg-abyss/20'
      }`}
    >
      <span className="rounded bg-abyss/80 px-1.5 text-[10px] font-black tracking-widest text-gold-light/90 uppercase sm:text-xs">
        {LANE_NAMES[lane]}
      </span>
    </button>
  )
}

interface LaneTokenProps {
  champion: string
  at: MapPoint
  /** Blue for you, red for them. */
  you: boolean
  /** Scale of the icon, as a share of the map. */
  size?: 'small' | 'large'
  /** Drops in from above (a Gate landing) instead of fading in. */
  drop?: boolean
  /** A short word under the icon: GATE, GUARD... */
  label?: string
}

/** A champion icon on the map, ringed blue (you) or red (them). */
export function LaneToken({ champion, at, you, size = 'small', drop = false, label }: LaneTokenProps) {
  return (
    <motion.div
      initial={drop ? { y: '-120%', scale: 1.8, opacity: 0 } : { scale: 0.4, opacity: 0 }}
      animate={{ y: 0, scale: 1, opacity: 1 }}
      transition={drop ? { type: 'spring', stiffness: 260, damping: 16 } : { duration: 0.25 }}
      style={placeAt(at)}
      className={`pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${size === 'large' ? 'w-[20%]' : 'w-[14%]'}`}
    >
      <img
        src={championIconById(champion)}
        alt=""
        className={`aspect-square w-full rounded-full border-[3px] shadow-lg shadow-black ${you ? 'border-hextech' : 'border-red-400'}`}
      />
      {label && (
        <span className={`mt-0.5 rounded px-1 text-[9px] font-black tracking-wider text-white uppercase sm:text-[10px] ${you ? 'bg-hextech/80' : 'bg-red-500/80'}`}>
          {label}
        </span>
      )}
    </motion.div>
  )
}
