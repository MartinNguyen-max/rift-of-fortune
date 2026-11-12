import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gameData, itemIconUrl } from '../../data'
import { winnerByScore } from '../../game/minigames/catalog'
import {
  addPart,
  botForgeTimes,
  botItemsDone,
  forgeOrders,
  missingParts,
  WRONG_PART_PENALTY,
  type ForgeOrder,
} from '../../game/minigames/forge'
import { GetReady } from '../multiplayer/games/GetReady'
import { useStopwatch } from '../multiplayer/games/useStopwatch'
import type { MiniGameProps } from './MiniGameShell'
import { championIconById } from './miniGameArt'

const formatTime = (seconds: number) => `${seconds.toFixed(2)} s`

/** Ornn's Rush Order: build 3 items from their parts, faster than the bot. */
export function ForgeGame({ seed, onFinish }: MiniGameProps) {
  const orders = useMemo(() => forgeOrders(seed, gameData.items, gameData.components), [seed])
  const botTimes = useMemo(() => botForgeTimes(seed, orders), [seed, orders])
  const botTotal = botTimes.at(-1) ?? 0
  const [started, setStarted] = useState(false)
  const [orderIndex, setOrderIndex] = useState(0)
  const [placed, setPlaced] = useState<string[]>([])
  const [penalty, setPenalty] = useState(0)
  const [mistake, setMistake] = useState<{ id: number; partId: string } | null>(null)
  const [done, setDone] = useState(false)
  const { seconds, read } = useStopwatch(started && !done)
  const finished = useRef(false)
  const order = orders[orderIndex]
  const clock = seconds + penalty

  const finish = useCallback(
    (playerTime: number | null) => {
      if (finished.current) return
      finished.current = true
      setDone(true)
      onFinish({
        winner: playerTime === null ? 'bot' : winnerByScore(playerTime, botTotal, true),
        player: playerTime === null ? `${orderIndex} / ${orders.length} items` : formatTime(playerTime),
        bot: formatTime(botTotal),
      })
    },
    [botTotal, onFinish, orderIndex, orders.length],
  )

  // The bot finishing all its items first ends the game.
  useEffect(() => {
    if (!started || done) return
    const id = window.setTimeout(() => finish(null), Math.max(0, botTotal - penalty - read()) * 1000)
    return () => window.clearTimeout(id)
  }, [started, done, botTotal, penalty, read, finish])

  const pick = (partId: string) => {
    if (!order || done || !started) return
    const result = addPart(order, placed, partId)
    if (result === 'wrong') {
      setPenalty((value) => value + WRONG_PART_PENALTY)
      // The penalty only grows, so it doubles as a unique id for the "+2s" popup.
      setMistake({ id: penalty + WRONG_PART_PENALTY, partId })
      return
    }
    if (result === 'added') {
      setPlaced([...placed, partId])
      return
    }
    if (orderIndex + 1 >= orders.length) {
      setPlaced([...placed, partId])
      finish(read() + penalty)
      return
    }
    setOrderIndex(orderIndex + 1)
    setPlaced([])
  }

  if (!order) return null
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between text-sm">
        <span className="font-mono text-lg font-bold text-gold-light">{formatTime(clock)}</span>
        <OrderTrack label="You" orders={orders} done={orderIndex + (done && placed.length > 0 ? 1 : 0)} icon={championIconById('Ornn')} />
        <OrderTrack label="Bot Ornn" orders={orders} done={botItemsDone(botTimes, clock)} icon={championIconById('Ornn')} bot />
      </div>

      <div className="relative w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={order.item.id}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <p className="text-xs tracking-widest text-gold-light/60 uppercase">
              Order {orderIndex + 1} of {orders.length}
            </p>
            <div className="flex items-center gap-3">
              <img src={itemIconUrl(order.item.image)} alt="" className="size-16 rounded-md border-2 border-gold shadow-lg shadow-gold/20" />
              <div>
                <p className="font-display text-xl font-black text-gold">{order.item.name}</p>
                <p className="text-sm text-gold-light/60">{order.item.gold} gold</p>
              </div>
            </div>
            <Anvil order={order} placed={placed} />
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>
          {mistake && (
            <motion.span
              key={mistake.id}
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: -30, opacity: 0 }}
              transition={{ duration: 1 }}
              className="pointer-events-none absolute top-0 right-4 font-display text-2xl font-black text-red-400"
            >
              +{WRONG_PART_PENALTY}s
            </motion.span>
          )}
        </AnimatePresence>
        {!started && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-panel/95">
            <GetReady onGo={() => setStarted(true)} />
          </div>
        )}
      </div>

      <div className="grid w-full grid-cols-4 gap-2">
        {order.tray.map((part) => (
          <motion.button
            key={`${order.item.id}-${part.id}`}
            type="button"
            onClick={() => pick(part.id)}
            disabled={!started || done}
            animate={mistake?.partId === part.id ? { x: [0, -6, 6, -4, 4, 0] } : {}}
            transition={{ duration: 0.35 }}
            className={`flex touch-manipulation flex-col items-center gap-1 rounded-lg border-2 bg-abyss/60 p-1.5 text-center transition enabled:hover:border-gold enabled:active:scale-95 ${
              mistake?.partId === part.id ? 'border-red-500' : 'border-gold/40'
            }`}
          >
            <img src={itemIconUrl(part.image)} alt="" className="size-10 rounded sm:size-12" draggable={false} />
            <span className="text-[11px] leading-tight text-gold-light/80 sm:text-xs">{part.name}</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

/** The build slots: placed parts lit up, missing ones empty. */
function Anvil({ order, placed }: { order: ForgeOrder; placed: string[] }) {
  const missing = missingParts(order, placed).length
  const slots = [...placed.map((id) => order.recipe.find((part) => part.id === id)), ...Array.from({ length: missing }, () => undefined)]
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-abyss/50 px-4 py-2">
      {slots.map((part, index) => (
        <span key={index} className="flex size-12 items-center justify-center rounded border-2 border-dashed border-gold/40">
          {part ? (
            <motion.img initial={{ scale: 0.4 }} animate={{ scale: 1 }} src={itemIconUrl(part.image)} alt={part.name} className="size-11 rounded" />
          ) : (
            <span className="font-display text-xl text-gold/40">?</span>
          )}
        </span>
      ))}
    </div>
  )
}

function OrderTrack({ label, orders, done, icon, bot = false }: { label: string; orders: ForgeOrder[]; done: number; icon: string; bot?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 ${bot ? 'flex-row-reverse' : ''}`} aria-label={`${label}: ${done} of ${orders.length} items`}>
      <img src={icon} alt="" className={`size-7 rounded-full border ${bot ? 'border-red-400/70' : 'border-gold/70'}`} />
      {orders.map((order, index) => (
        <img
          key={order.item.id}
          src={itemIconUrl(order.item.image)}
          alt=""
          className={`size-6 rounded-sm border ${index < done ? 'border-gold' : 'border-gold/20 opacity-30 grayscale'}`}
        />
      ))}
    </div>
  )
}
