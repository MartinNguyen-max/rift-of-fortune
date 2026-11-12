import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { gameData, itemIconUrl } from '../data'
import type { Item } from '../data/types'
import { useSpin } from './useSpin'

/** Fewer, faster frames than the champion roll, since there are more items to roll. */
const SPIN_FRAMES = 10
const spinDelayMs = (frame: number) => 20 + frame * frame * 0.8
/** Pause on each landed item before the next one starts spinning. */
const HOLD_MS = 220
const REDUCED_HOLD_MS = 60
const iconUrl = (item: Item) => itemIconUrl(item.image)

interface ItemRollProps {
  items: Item[]
  round: number
  totalRounds: number
  onDone: () => void
}

/** Rolls a round's items one at a time, each with its own short slot-machine spin. */
export function ItemRoll({ items, round, totalRounds, onDone }: ItemRollProps) {
  const [current, setCurrent] = useState(0)
  const [landed, setLanded] = useState(false)
  const reduceMotion = useReducedMotion() === true
  const markLanded = useCallback(() => setLanded(true), [])
  const item = items[current]

  useEffect(() => {
    if (!landed) return
    const timer = setTimeout(
      () => {
        if (current + 1 >= items.length) return onDone()
        setCurrent(current + 1)
        setLanded(false)
      },
      reduceMotion ? REDUCED_HOLD_MS : HOLD_MS,
    )
    return () => clearTimeout(timer)
  }, [landed, current, items.length, onDone, reduceMotion])

  const revealedCount = landed ? current + 1 : current

  return (
    <section className="flex flex-col items-center gap-3 text-center lg:gap-5">
      <h2 className="text-sm font-semibold tracking-widest text-gold/80 uppercase">
        Round {round} of {totalRounds} · Item {Math.min(current + 1, items.length)} of {items.length}
      </h2>
      {item && <SpinningItem key={item.id} item={item} onLanded={markLanded} />}
      <ul className="grid w-full grid-cols-5 gap-2" aria-label="Rolled items">
        {items.map((rolledItem, index) => (
          <li key={rolledItem.id} className="flex justify-center">
            {index < revealedCount ? (
              <motion.img
                src={iconUrl(rolledItem)}
                alt={rolledItem.name}
                title={rolledItem.name}
                className="size-12 rounded border-2 border-gold/60"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              />
            ) : (
              <div className="flex size-12 items-center justify-center rounded border-2 border-dashed border-gold/30 text-gold/40">
                ?
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

interface SpinningItemProps {
  item: Item
  onLanded: () => void
}

function SpinningItem({ item, onLanded }: SpinningItemProps) {
  const { frame, landed } = useSpin({
    target: item,
    pool: gameData.items,
    spinFrames: SPIN_FRAMES,
    delayMs: spinDelayMs,
    imageUrl: iconUrl,
    onLanded,
  })

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        className="relative size-14 overflow-hidden rounded-xl border-2 border-hextech lg:size-20 shadow-lg shadow-hextech/30"
        animate={landed ? { scale: [1, 1.15, 1] } : { scale: 1 }}
        transition={{ duration: 0.25 }}
      >
        {frame && (
          <motion.img
            key={frame.id}
            src={iconUrl(frame)}
            alt=""
            className="size-full object-cover"
            initial={{ y: -20, opacity: 0.4 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.06 }}
          />
        )}
      </motion.div>
      <p className={`h-6 font-semibold ${landed ? 'text-gold-light' : 'text-gold-light/60'}`}>{frame?.name ?? '...'}</p>
    </div>
  )
}
