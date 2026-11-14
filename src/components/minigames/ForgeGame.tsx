import { animate, motion } from 'framer-motion'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type Ref } from 'react'
import { gameData, itemIconUrl } from '../../data'
import type { Item, ItemComponent } from '../../data/types'
import {
  addPart,
  botForgeTimes,
  botItemsDone,
  FORGE_LIMIT_SECONDS,
  forgeOrders,
  WRONG_PART_PENALTY,
  type ForgeOrder,
} from '../../game/minigames/forge'
import { MINI_GAME_RULES } from '../../game/minigames/registry'
import { other, type GameSetup, type Player, type Settled } from '../../game/minigames/versus'
import { forgeTutorialPicks, offsetBetween, trayColumns, useForgeClock, type Offset } from './forgeScreen'
import { GetReady } from './GetReady'
import { championIconById } from './miniGameArt'
import { BigCall, Waiting } from './parts'
import { useShownWhen, useTimeout } from './timing'
import type { Contestant, MiniGameViewProps, TutorialArtProps } from './types'

const FORGE_RULES = MINI_GAME_RULES.forge
/** The "STITCHED!" moment after each item. Your clock stops meanwhile: it isn't your time. */
const STITCHED_PAUSE_MS = 1000
/** The last call and both times stay up this long before the result covers the game. */
const FINAL_MOMENT_MS = 2600

interface PlacedPart {
  part: ItemComponent
  /** Where it flew in from: the tray button, relative to its slot on the workbench. */
  from: Offset
}

type Ending = 'forged' | 'late'

/** Gwen's Rush Order: stitch 3 items together from their parts. Your time (plus 2 s per wrong part) is your move. */
export function ForgeGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const solo = setup.variant === 'solo'
  const orders = useMemo(
    () => forgeOrders(setup.seed, gameData.items, gameData.components, setup.variant),
    [setup.seed, setup.variant],
  )
  const botTimes = useMemo(() => botForgeTimes(setup.seed, orders), [setup.seed, orders])
  // Solo: the bot's time is known up front, so passing it means you lost. Multiplayer: the time limit.
  const botMs = solo ? moves[them][0] : undefined
  const deadline = botMs === undefined ? FORGE_LIMIT_SECONDS : Math.min(botMs / 1000, FORGE_LIMIT_SECONDS)

  const [started, setStarted] = useState(false)
  const [orderIndex, setOrderIndex] = useState(0)
  const [placed, setPlaced] = useState<PlacedPart[]>([])
  const [mistakes, setMistakes] = useState(0)
  const [wrongPart, setWrongPart] = useState<string | null>(null)
  const [forging, setForging] = useState(false)
  const [ending, setEnding] = useState<Ending | null>(null)
  const workbench = useRef<HTMLDivElement>(null)

  // Your move may also be filled in by the host when you are too slow: either way you are done.
  const myMs = moves[me][0]
  const finished = ending !== null || myMs !== undefined
  const running = started && !forging && !finished
  const { seconds, read } = useForgeClock(running)
  const penalty = mistakes * WRONG_PART_PENALTY
  const clock = seconds + penalty
  const shownSeconds = myMs !== undefined && myMs < FORGE_LIMIT_SECONDS * 1000 ? myMs / 1000 : clock
  const settled = FORGE_RULES.settle(moves, setup)
  useShownWhen(settled !== null, onShown, FINAL_MOMENT_MS)

  const giveUp = useCallback(() => {
    setEnding('late')
    sendMove(0, FORGE_LIMIT_SECONDS * 1000)
  }, [sendMove])

  useEffect(() => {
    if (!running) return
    const id = window.setTimeout(giveUp, Math.max(0, deadline - penalty - read()) * 1000)
    return () => window.clearTimeout(id)
  }, [running, deadline, penalty, read, giveUp])

  useTimeout(
    () => {
      setOrderIndex(orderIndex + 1)
      setPlaced([])
      setWrongPart(null)
      setForging(false)
    },
    STITCHED_PAUSE_MS,
    forging && !finished,
  )
  const start = useCallback(() => setStarted(true), [])

  const order = orders[orderIndex]
  if (!order) return null

  const pick = (part: ItemComponent, button: HTMLElement) => {
    if (!running) return
    const result = addPart(
      order,
      placed.map((placedPart) => placedPart.part.id),
      part.id,
    )
    if (result === 'wrong') {
      setMistakes(mistakes + 1)
      setWrongPart(part.id)
      animate(button, { x: [0, -7, 7, -4, 4, 0] }, { duration: 0.35 })
      return
    }
    const slot = workbench.current?.querySelectorAll('[data-slot]')[placed.length]
    setPlaced([...placed, { part, from: offsetBetween(button, slot) }])
    if (result === 'added') return
    setForging(true)
    if (orderIndex + 1 >= orders.length) {
      setEnding('forged')
      sendMove(0, Math.round((read() + penalty) * 1000))
    }
  }

  const myItems = orderIndex + (forging ? 1 : 0)
  const botItems = ending === 'late' ? orders.length : botItemsDone(botTimes, clock)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TailorTrack contestant={players[me]} you orders={orders} done={myItems} />
        <Clock seconds={shownSeconds} mistakes={mistakes} />
        <TailorTrack contestant={players[them]} you={false} orders={orders} done={solo ? botItems : null} />
      </div>

      <div className="relative flex w-full flex-col items-center gap-4">
        <div className="relative z-10 w-full">
          <motion.div
            key={orderIndex}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-3"
          >
            <p className="text-xs tracking-widest text-gold-light/60 uppercase">
              Order {orderIndex + 1} / {orders.length}
            </p>
            <ItemPlate item={order.item} forged={forging} />
            <Workbench ref={workbench} order={order} placed={placed} forged={forging} />
          </motion.div>
          {mistakes > 0 && <PenaltyPop key={mistakes} />}
          {ending === 'late' ? (
            <BigCall
              overlay
              text={solo ? 'Too slow!' : 'Time!'}
              tone="lose"
              size="large"
              sub={solo ? `${players[them].name} finished first` : 'Not finished'}
            />
          ) : (
            forging && <BigCall overlay text="Stitched!" tone="win" />
          )}
        </div>

        {!finished ? (
          <Tray key={orderIndex} parts={order.tray} enabled={running} wrongPart={wrongPart} onPick={pick} />
        ) : settled ? (
          <FinalTimes settled={settled} me={me} players={players} setup={setup} />
        ) : (
          <Waiting name={players[them].name} />
        )}

        {!started && !finished && (
          <div className="absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-panel">
            <GetReady onGo={start} />
          </div>
        )}
      </div>
    </div>
  )
}

function Clock({ seconds, mistakes }: { seconds: number; mistakes: number }) {
  return (
    <motion.span
      key={mistakes}
      initial={mistakes > 0 ? { scale: 1.35, color: '#f87171' } : false}
      animate={{ scale: 1, color: '#f0e6d2' }}
      transition={{ duration: 0.6 }}
      className="font-mono text-xl font-bold tabular-nums sm:text-2xl"
      role="timer"
    >
      {seconds.toFixed(2)} s
    </motion.span>
  )
}

interface TailorTrackProps {
  contestant: Contestant
  you: boolean
  orders: readonly ForgeOrder[]
  /** Items built so far, or null to keep it hidden ("?"). */
  done: number | null
}

/** A tailor and the three items: lit once stitched. */
function TailorTrack({ contestant, you, orders, done }: TailorTrackProps) {
  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${you ? '' : 'flex-row-reverse text-right'}`}>
      <img
        src={championIconById(contestant.champion)}
        alt=""
        className={`size-9 shrink-0 rounded-full border-2 ${you ? 'border-hextech' : 'border-red-400'}`}
      />
      <div className={`flex min-w-0 flex-col gap-0.5 ${you ? 'items-start' : 'items-end'}`}>
        <span className={`text-xs font-semibold [overflow-wrap:anywhere] ${you ? 'text-hextech' : 'text-red-400'}`}>
          {contestant.name}
        </span>
        {done === null ? (
          <span className="font-display text-lg leading-none font-black text-gold">?</span>
        ) : (
          <div className="flex gap-0.5">
            {orders.map((order, index) => (
              <img
                key={order.item.id}
                src={itemIconUrl(order.item.image)}
                alt=""
                className={`size-5 rounded-sm border transition sm:size-6 ${index < done ? 'border-gold' : 'border-gold/20 opacity-30 grayscale'}`}
              />
            ))}
            <span className="sr-only">
              {done} of {orders.length} items
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/** The item to stitch. It glows once done. */
function ItemPlate({ item, forged }: { item: Item; forged: boolean }) {
  return (
    <div className="flex max-w-full items-center gap-3">
      <motion.div
        animate={forged ? { scale: [1, 1.3, 1.15], rotate: [0, -5, 0] } : { scale: 1, rotate: 0 }}
        transition={{ duration: 0.5 }}
        className="relative shrink-0"
      >
        {forged && (
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.3, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
            className="absolute -inset-2 rounded-lg bg-gold/50 blur-md"
            aria-hidden="true"
          />
        )}
        <img src={itemIconUrl(item.image)} alt="" className="relative size-16 rounded-md border-2 border-gold shadow-lg shadow-gold/20" />
      </motion.div>
      <div className="min-w-0">
        <p className="font-display text-xl font-black text-gold [overflow-wrap:anywhere]">{item.name}</p>
        <p className="text-sm text-gold-light/60">{item.gold} gold</p>
      </div>
    </div>
  )
}

interface WorkbenchProps {
  ref: Ref<HTMLDivElement>
  order: ForgeOrder
  placed: readonly PlacedPart[]
  forged: boolean
}

/** One slot per part of the recipe: filled as right parts fly in. */
function Workbench({ ref, order, placed, forged }: WorkbenchProps) {
  return (
    <div
      ref={ref}
      className={`flex items-center gap-1.5 rounded-lg border bg-abyss/50 px-3 py-2 transition-colors ${forged ? 'border-gold' : 'border-gold/30'}`}
    >
      {order.recipe.map((_, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span className="font-display text-lg font-black text-gold/50" aria-hidden="true">
              +
            </span>
          )}
          <Slot placed={placed[index]} forged={forged} />
        </Fragment>
      ))}
    </div>
  )
}

function Slot({ placed, forged }: { placed: PlacedPart | undefined; forged: boolean }) {
  return (
    <span
      data-slot
      className={`relative flex size-12 items-center justify-center rounded border-2 sm:size-14 ${placed ? 'border-gold' : 'border-dashed border-gold/40'}`}
    >
      {placed ? (
        <>
          <motion.img
            initial={{ x: placed.from.x, y: placed.from.y, scale: 0.8 }}
            animate={{ x: 0, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            src={itemIconUrl(placed.part.image)}
            alt={placed.part.name}
            className="relative z-10 size-full rounded-sm"
            draggable={false}
          />
          <motion.span
            initial={{ opacity: 0 }}
            animate={forged ? { opacity: [0.5, 1, 0.5] } : { opacity: [0, 1, 0] }}
            transition={forged ? { duration: 0.9, repeat: Infinity } : { delay: 0.2, duration: 0.7 }}
            className="pointer-events-none absolute -inset-1 rounded-md shadow-[0_0_16px_5px_rgb(200_170_110/0.75)]"
            aria-hidden="true"
          />
        </>
      ) : (
        <span className="font-display text-xl text-gold/40">?</span>
      )}
    </span>
  )
}

function PenaltyPop() {
  return (
    <motion.span
      initial={{ y: 0, opacity: 1, scale: 1.4 }}
      animate={{ y: -30, opacity: 0, scale: 1 }}
      transition={{ duration: 1 }}
      className="pointer-events-none absolute top-0 right-2 z-20 font-display text-2xl font-black text-red-400"
      role="status"
    >
      +{WRONG_PART_PENALTY}s
    </motion.span>
  )
}

interface TrayProps {
  parts: readonly ItemComponent[]
  enabled: boolean
  /** The last wrong part, outlined red. */
  wrongPart: string | null
  onPick: (part: ItemComponent, button: HTMLElement) => void
}

/** The parts on offer: the recipe plus decoys. */
function Tray({ parts, enabled, wrongPart, onPick }: TrayProps) {
  return (
    <div
      className="grid w-full max-w-lg gap-2"
      style={{ gridTemplateColumns: `repeat(${trayColumns(parts.length)}, minmax(0, 1fr))` }}
    >
      {parts.map((part) => (
        <button
          key={part.id}
          type="button"
          disabled={!enabled}
          onPointerDown={(event) => onPick(part, event.currentTarget)}
          // A keyboard "click" (Enter or Space on a focused button) has no pointer down.
          onClick={(event) => {
            if (event.detail === 0) onPick(part, event.currentTarget)
          }}
          className={`flex min-w-0 touch-manipulation flex-col items-center gap-1 rounded-lg border-2 bg-abyss/60 p-1 text-center sm:p-1.5 transition-[scale,border-color,opacity] select-none enabled:hover:border-gold enabled:active:scale-95 disabled:opacity-60 ${
            wrongPart === part.id ? 'border-red-500' : 'border-gold/40'
          }`}
        >
          <img src={itemIconUrl(part.image)} alt="" className="size-10 rounded sm:size-12" draggable={false} />
          <span className="text-[11px] leading-tight text-gold-light/85 [overflow-wrap:anywhere] sm:text-xs">{part.name}</span>
        </button>
      ))}
    </div>
  )
}

interface FinalTimesProps {
  settled: Settled
  me: Player
  players: readonly [Contestant, Contestant]
  setup: GameSetup
}

/** Both times side by side, the winner's in gold. */
function FinalTimes({ settled, me, players, setup }: FinalTimesProps) {
  const them = other(me)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="flex w-full max-w-sm items-start justify-center gap-4"
      aria-live="polite"
    >
      <Tally contestant={players[me]} you value={FORGE_RULES.formatScore(settled.scores[me], setup)} won={settled.winner === me} />
      <span className="self-center font-display text-sm font-bold text-gold-light/50">VS</span>
      <Tally
        contestant={players[them]}
        you={false}
        value={FORGE_RULES.formatScore(settled.scores[them], setup)}
        won={settled.winner === them}
      />
    </motion.div>
  )
}

function Tally({ contestant, you, value, won }: { contestant: Contestant; you: boolean; value: string; won: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
      <img
        src={championIconById(contestant.champion)}
        alt=""
        className={`size-10 rounded-full border-2 ${you ? 'border-hextech' : 'border-red-400'}`}
      />
      <span className={`text-xs font-semibold [overflow-wrap:anywhere] ${you ? 'text-hextech' : 'text-red-400'}`}>{contestant.name}</span>
      <motion.span
        initial={{ scale: 0.6 }}
        animate={{ scale: won ? 1.15 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.5 }}
        className={`font-display text-xl font-black ${won ? 'text-gold drop-shadow-[0_0_10px_rgb(200_170_110/0.7)]' : 'text-gold-light/60'}`}
      >
        {value}
      </motion.span>
    </div>
  )
}

const TUTORIAL = forgeTutorialPicks(gameData.items, gameData.components)

/** 1: an item to build. 2: its parts light up, a wrong one costs +2s. 3: three items against the clock. */
export function ForgeTutorialArt({ step }: TutorialArtProps) {
  if (step === 0) return <OrderArt />
  if (step === 1) return <PartsArt />
  return <RaceArt />
}

function OrderArt() {
  if (!TUTORIAL.item) return null
  return (
    <div className="relative flex size-full items-center justify-center">
      <motion.span
        animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.9, 1.2, 0.9] }}
        transition={{ duration: 1.6, repeat: Infinity }}
        className="absolute size-1/2 rounded-lg bg-gold/50 blur-md"
      />
      <img src={itemIconUrl(TUTORIAL.item.image)} alt="" className="relative size-1/2 rounded-md border-2 border-gold" />
    </div>
  )
}

function PartsArt() {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 p-2">
      <div className="flex w-full justify-center gap-2">
        {TUTORIAL.parts.map((part, index) => {
          const tap = { duration: 0.9, delay: index * 0.6, repeat: Infinity, repeatDelay: 1.5 }
          return (
            <motion.div key={`${part.id}-${index}`} animate={{ scale: [1, 0.85, 1.1, 1] }} transition={tap} className="relative w-[40%]">
              <motion.span
                animate={{ opacity: [0, 0, 1, 0] }}
                transition={tap}
                className="absolute -inset-1 rounded-md bg-gold/60 blur-sm"
              />
              <img src={itemIconUrl(part.image)} alt="" className="relative aspect-square w-full rounded border-2 border-gold" />
            </motion.div>
          )
        })}
      </div>
      {TUTORIAL.decoy && (
        <div className="flex w-full items-center justify-center gap-1.5">
          <motion.img
            src={itemIconUrl(TUTORIAL.decoy.image)}
            alt=""
            animate={{ x: [0, -3, 3, -2, 2, 0] }}
            transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 1.6 }}
            className="aspect-square w-[34%] rounded border-2 border-red-500"
          />
          <span className="font-display text-base font-black text-red-400 sm:text-lg">+2s</span>
        </div>
      )}
    </div>
  )
}

function RaceArt() {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2">
      <Stopwatch />
      <div className="flex w-full justify-center gap-1">
        {TUTORIAL.items.map((item) => (
          <img key={item.id} src={itemIconUrl(item.image)} alt="" className="aspect-square w-[27%] rounded border border-gold" />
        ))}
      </div>
    </div>
  )
}

function Stopwatch() {
  return (
    <svg viewBox="0 0 24 24" className="size-1/3 text-gold-light" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="14" r="8" />
      <path d="M10 2.5h4M12 2.5V6" />
      <motion.line
        x1="12"
        y1="14"
        x2="12"
        y2="9"
        className="text-hextech"
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        style={{ originX: 0.5, originY: 1 }}
      />
    </svg>
  )
}
