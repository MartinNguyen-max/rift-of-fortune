import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { championLoadingUrl, spellIconUrl } from '../../data'
import {
  CLEAVER_HITS_TO_WIN,
  CLEAVER_RULES,
  cleaverTurns,
  dodgeTo,
  hitsLanded,
  isSpot,
  MAX_TURNS,
  reachable,
  SPOTS,
  spotsAfter,
  START_SPOT,
  throwerOf,
  TURN_SECONDS,
  type CleaverTurn,
  type Spot,
} from '../../game/minigames/cleaver'
import { MINI_GAMES } from '../../game/minigames/catalog'
import { other, type Player } from '../../game/minigames/versus'
import { FLIGHT_S, LAUNCH_DELAY_S, timeoutSpot, useCleaverStage, useSpotKeys } from './cleaverScreen'
import { championIconById, SKINS } from './miniGameArt'
import { BigCall, ChoiceTimer, Waiting, type Tone } from './parts'
import { useShownWhen } from './timing'
import type { MiniGameViewProps, TutorialArtProps } from './types'

/** Shown health: each dagger takes a third. */
const MAX_HP = 2400
const DAMAGE = MAX_HP / CLEAVER_HITS_TO_WIN
const SHOWN_DELAY_MS = 500
const TRAIL_GAP_S = 0.035
const ALL_SPOTS: readonly Spot[] = [0, 1, 2]
const DAGGER_ICON = spellIconUrl('KatarinaQ.png')

/** You are always on the left (blue), the opponent on the right (red). */
type Side = 'me' | 'them'
const SIDES: readonly Side[] = ['me', 'them']

/** In the mirror match each side wears its own Katarina skin, so you can tell them apart. */
const SIDE_SKINS: Readonly<Record<string, Record<Side, number>>> = {
  Katarina: { me: SKINS.battleAcademiaKatarina, them: SKINS.bloodMoonKatarina },
}
const fighterArt = (champion: string, side: Side) => championLoadingUrl(champion, SIDE_SKINS[champion]?.[side] ?? 0)

/** A place in the arena, in percent of its width and height. */
interface Point {
  x: number
  y: number
}
const SIDE_X: Record<Side, number> = { me: 18, them: 82 }
const spotY = (spot: Spot) => ((2 * spot + 1) / 6) * 100
const pointOf = (side: Side, spot: Spot): Point => ({ x: SIDE_X[side], y: spotY(spot) })
const placeAt = ({ x, y }: Point) => ({ left: `${x}%`, top: `${y}%` })
const asSpot = (move: number): Spot => (isSpot(move) ? move : START_SPOT)

interface Picked {
  turn: number
  spot: Spot
}

/** Katarina's Dagger Dance: one throws, one dodges, both at once. Three daggers and she goes down. */
export function CleaverGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const turns = useMemo(() => cleaverTurns(moves, setup), [moves, setup])
  const over = useMemo(() => CLEAVER_RULES.settle(moves, setup) !== null, [moves, setup])
  /** Your choice, shown at once even before it comes back in `moves`. */
  const [picked, setPicked] = useState<Picked | null>(null)
  /** Where the keyboard aim is this turn. */
  const [aimed, setAimed] = useState<Picked | null>(null)
  const [finePointer] = useState(() => window.matchMedia('(pointer: fine)').matches)
  const yourMoveAt = (turn: number) => moves[me][turn] ?? (picked?.turn === turn ? picked.spot : undefined)
  const stage = useCleaverStage(turns.length, over, (turn) => yourMoveAt(turn) !== undefined)
  useShownWhen(stage.kind === 'over', onShown, SHOWN_DELAY_MS)

  const { kind, turn } = stage
  const before = useMemo(() => spotsAfter(turns.slice(0, turn)), [turns, turn])
  const yourSpot = before[me]
  const theirSpot = before[them]
  const youThrow = throwerOf(turn, setup) === me
  const choosing = kind === 'choose'
  const allowed = useMemo(() => (youThrow ? ALL_SPOTS : reachable(yourSpot)), [youThrow, yourSpot])
  const aim = aimed?.turn === turn ? aimed.spot : youThrow ? theirSpot : yourSpot

  const pick = useCallback(
    (spot: Spot) => {
      if (!choosing) return
      setPicked({ turn, spot })
      sendMove(turn, spot)
    },
    [choosing, turn, sendMove],
  )
  const aimAt = useCallback((spot: Spot) => setAimed({ turn, spot }), [turn])
  const confirmAim = useCallback(() => pick(aim), [pick, aim])
  useSpotKeys({ enabled: choosing, allowed, aim, onAim: aimAt, onConfirm: confirmAim })

  const landing = kind === 'flight' || kind === 'impact' ? turns[turn] : undefined
  const yourMove = yourMoveAt(turn)
  const yourPick = kind === 'waiting' && yourMove !== undefined ? asSpot(yourMove) : null
  const hits = hitsLanded(turns.slice(0, kind === 'impact' ? turn + 1 : turn))
  const taken: Record<Side, number> = { me: hits[them], them: hits[me] }
  const art: Record<Side, string> = { me: fighterArt(players[me].champion, 'me'), them: fighterArt(players[them].champion, 'them') }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-2">
      <div className="flex h-14 w-full items-center justify-center">
        {choosing && (
          <ChoiceTimer
            key={turn}
            seconds={TURN_SECONDS[setup.variant]}
            label={youThrow ? 'Throw' : 'Dodge'}
            onTimeout={() => pick(timeoutSpot(turn, setup, youThrow, yourSpot))}
          />
        )}
        {kind === 'waiting' && <Waiting name={players[them].name} />}
      </div>
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-end gap-2">
        <HealthBar name={players[me].name} taken={taken.me} side="me" />
        <TurnCounter turn={Math.min(kind === 'over' ? turn : turn + 1, MAX_TURNS[setup.variant])} max={MAX_TURNS[setup.variant]} />
        <HealthBar name={players[them].name} taken={taken.them} side="them" />
      </div>
      <div className="flex h-9 items-center" aria-live="polite">
        {kind !== 'over' && <RoleLabel youThrow={youThrow} />}
      </div>
      <Arena
        art={art}
        spots={standingSpots(landing, before, me, youThrow ? null : yourPick)}
        throwerSide={youThrow ? 'me' : 'them'}
        holding={kind === 'announce' || choosing || kind === 'waiting'}
        choice={choosing ? { side: youThrow ? 'them' : 'me', allowed, likely: youThrow ? reachable(theirSpot) : allowed } : null}
        aim={choosing && (finePointer || aimed?.turn === turn) ? aim : null}
        onPick={pick}
        onAim={aimAt}
        target={targetOf(landing, me, youThrow ? yourPick : null)}
        flight={landing ? flightOf(landing, before, me) : null}
        landed={kind === 'impact'}
        down={{ me: taken.me >= CLEAVER_HITS_TO_WIN, them: taken.them >= CLEAVER_HITS_TO_WIN }}
      >
        <AnimatePresence>
          {kind === 'announce' && (
            <Overlay key={`announce-${turn}`} dim>
              <BigCall text={youThrow ? 'THROW' : 'DODGE'} tone="you" sub={youThrow ? 'Hit their spot' : 'Move 1 spot'} />
            </Overlay>
          )}
          {kind === 'impact' && landing && (
            <Overlay key={`impact-${turn}`}>
              <BigCall size="large" {...turnCall(landing, me)} />
            </Overlay>
          )}
        </AnimatePresence>
      </Arena>
      <p className="text-xs text-gold-light/50">Tap a circle · ↑ ↓ Enter</p>
    </div>
  )
}

/** Where both fighters stand right now: the dodger hops as soon as their spot is known. */
function standingSpots(landing: CleaverTurn | undefined, before: [Spot, Spot], me: Player, yourDodge: Spot | null): Record<Side, Spot> {
  const them = other(me)
  if (landing) {
    const dodger = other(landing.thrower)
    return { me: dodger === me ? landing.to : before[me], them: dodger === them ? landing.to : before[them] }
  }
  return { me: yourDodge === null ? before[me] : dodgeTo(before[me], yourDodge), them: before[them] }
}

/** The spot a dagger is aimed at: yours once you chose, theirs once revealed. */
function targetOf(landing: CleaverTurn | undefined, me: Player, yourThrow: Spot | null): Target | null {
  if (landing) {
    const yours = landing.thrower === me
    return { point: pointOf(yours ? 'them' : 'me', landing.target), yours }
  }
  return yourThrow === null ? null : { point: pointOf('them', yourThrow), yours: true }
}

function flightOf(landing: CleaverTurn, before: [Spot, Spot], me: Player): Flight {
  const yours = landing.thrower === me
  return {
    from: pointOf(yours ? 'me' : 'them', before[landing.thrower]),
    to: pointOf(yours ? 'them' : 'me', landing.target),
    hit: landing.hit,
    yours,
  }
}

function turnCall({ thrower, hit }: CleaverTurn, me: Player): { text: string; tone: Tone } {
  const yours = thrower === me
  if (hit) return yours ? { text: 'HIT!', tone: 'win' } : { text: 'OUCH!', tone: 'lose' }
  return yours ? { text: 'MISSED', tone: 'lose' } : { text: 'DODGED!', tone: 'win' }
}

interface Choice {
  /** Whose circles you tap: theirs to throw, yours to dodge. */
  side: Side
  allowed: readonly Spot[]
  /** Highlighted: where you can dodge to, or where they can be when you throw. */
  likely: readonly Spot[]
}

interface Target {
  point: Point
  yours: boolean
}

interface Flight {
  from: Point
  to: Point
  hit: boolean
  /** You threw it. */
  yours: boolean
}

type CircleLook = 'plain' | 'open' | 'far' | 'closed'

function circleLook(choice: Choice | null, side: Side, spot: Spot): CircleLook {
  if (!choice || choice.side !== side) return 'plain'
  if (!choice.allowed.includes(spot)) return 'closed'
  return choice.likely.includes(spot) ? 'open' : 'far'
}

interface ArenaProps {
  /** Each side's champion art. */
  art: Record<Side, string>
  spots: Record<Side, Spot>
  throwerSide: Side
  /** The thrower still holds the dagger. */
  holding: boolean
  choice: Choice | null
  /** The keyboard aim, when shown. */
  aim: Spot | null
  onPick: (spot: Spot) => void
  onAim: (spot: Spot) => void
  target: Target | null
  flight: Flight | null
  /** The dagger has landed (or whiffed). */
  landed: boolean
  down: Record<Side, boolean>
  children: ReactNode
}

/** Three spots a side, both fighters on theirs, and the dagger flying between them. */
function Arena({ art, spots, throwerSide, holding, choice, aim, onPick, onAim, target, flight, landed, down, children }: ArenaProps) {
  const impact = landed && flight?.hit === true
  const hurt: Side | null = impact && flight ? (flight.yours ? 'them' : 'me') : null
  return (
    <motion.div
      animate={impact ? { x: [0, -12, 12, -8, 8, -3, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      className="relative h-72 w-full touch-manipulation overflow-hidden rounded-xl border-2 border-gold/40 bg-linear-to-r from-cyan-950/70 via-slate-900/60 to-red-950/70 select-none sm:h-80"
      role="group"
      aria-label="Arena"
    >
      <LaneLabels />
      {SIDES.flatMap((side) =>
        ALL_SPOTS.map((spot) => (
          <SpotCircle
            key={`${side}-${spot}`}
            side={side}
            spot={spot}
            look={circleLook(choice, side, spot)}
            aimed={choice?.side === side && aim === spot}
            onPick={onPick}
            onAim={onAim}
          />
        )),
      )}
      {SIDES.map((side) => (
        <FighterToken
          key={side}
          art={art[side]}
          side={side}
          spot={spots[side]}
          holding={holding && throwerSide === side}
          hurt={hurt === side}
          down={down[side]}
        />
      ))}
      {target && <TargetMark key={`${target.point.x}-${target.point.y}`} {...target} />}
      {flight && !landed && <FlyingDagger {...flight} />}
      {flight && landed && <DaggerLanding {...flight} />}
      {children}
    </motion.div>
  )
}

function LaneLabels() {
  return (
    <>
      {ALL_SPOTS.map((spot) => (
        <span
          key={spot}
          style={placeAt({ x: 50, y: spotY(spot) })}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[10px] tracking-[0.3em] text-gold-light/30 uppercase"
          aria-hidden="true"
        >
          {SPOTS[spot]}
        </span>
      ))}
    </>
  )
}

const LOOK_RING: Record<CircleLook, string> = {
  plain: 'border-gold/25 bg-abyss/40',
  open: 'border-hextech bg-hextech/20 shadow-[0_0_18px_rgb(10_200_185/0.7)]',
  far: 'border-hextech/40 bg-hextech/5 opacity-60',
  closed: 'border-gold/10 bg-abyss/20 opacity-30',
}

interface SpotCircleProps {
  side: Side
  spot: Spot
  look: CircleLook
  aimed: boolean
  onPick: (spot: Spot) => void
  onAim: (spot: Spot) => void
}

function SpotCircle({ side, spot, look, aimed, onPick, onAim }: SpotCircleProps) {
  const tappable = look === 'open' || look === 'far'
  return (
    <button
      type="button"
      disabled={!tappable}
      aria-label={`${side === 'me' ? 'Dodge to' : 'Throw at'} ${SPOTS[spot]}`}
      onPointerDown={tappable ? () => onPick(spot) : undefined}
      onFocus={tappable ? () => onAim(spot) : undefined}
      style={placeAt(pointOf(side, spot))}
      className="absolute flex size-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer touch-manipulation items-center justify-center rounded-full outline-none disabled:cursor-default sm:size-24"
    >
      <motion.span
        animate={look === 'open' ? { scale: [1, 1.1, 1] } : { scale: 1 }}
        transition={look === 'open' ? { duration: 0.9, repeat: Infinity } : { duration: 0.2 }}
        className={`size-16 rounded-full border-4 transition-colors sm:size-20 ${LOOK_RING[look]}`}
      />
      {aimed && (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0 rounded-full border-2 border-dashed border-gold"
          aria-hidden="true"
        />
      )}
    </button>
  )
}

interface FighterTokenProps {
  art: string
  side: Side
  spot: Spot
  holding: boolean
  hurt: boolean
  down: boolean
}

/** A fighter on their spot. Hops when they dodge, flashes red when hit, falls when out of health. */
function FighterToken({ art, side, spot, holding, hurt, down }: FighterTokenProps) {
  const yours = side === 'me'
  return (
    <motion.div
      initial={false}
      animate={{ top: `${spotY(spot)}%` }}
      transition={{ type: 'spring', stiffness: 380, damping: 18 }}
      style={{ left: `${SIDE_X[side]}%` }}
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
    >
      <motion.img
        src={art}
        alt={yours ? 'You' : 'Your opponent'}
        draggable={false}
        animate={tokenPose(yours, hurt, down)}
        transition={{ duration: 0.4 }}
        className={`size-14 rounded-full border-4 object-cover object-top sm:size-16 ${yours ? 'border-hextech' : '-scale-x-100 border-red-400'} ${
          down ? 'grayscale' : ''
        }`}
      />
      {hurt && (
        <motion.span
          initial={{ opacity: 0.85 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 rounded-full bg-red-500"
          aria-hidden="true"
        />
      )}
      {holding && (
        <motion.img
          src={DAGGER_ICON}
          alt=""
          animate={{ rotate: yours ? [-25, 15, -25] : [25, -15, 25] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className={`absolute -top-2 size-7 rounded-full border-2 border-gold ${yours ? '-right-3' : '-left-3'}`}
        />
      )}
    </motion.div>
  )
}

/** Falls over when out of health, shakes when hit, otherwise stands. */
function tokenPose(yours: boolean, hurt: boolean, down: boolean) {
  if (down) return { rotate: yours ? -80 : 80, opacity: 0.55, x: 0 }
  if (hurt) return { x: [0, -6, 6, -4, 4, 0] }
  return { rotate: 0, opacity: 1, x: 0 }
}

/** A ring with four ticks on the spot a dagger goes to. */
function TargetMark({ point, yours }: Target) {
  const color = yours ? 'bg-hextech' : 'bg-red-400'
  return (
    <motion.span
      initial={{ scale: 1.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.25 }}
      style={placeAt(point)}
      className={`pointer-events-none absolute z-10 size-18 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 sm:size-22 ${
        yours ? 'border-hextech' : 'border-red-400'
      }`}
      aria-hidden="true"
    >
      <span className={`absolute -top-3 left-1/2 h-3 w-1 -translate-x-1/2 ${color}`} />
      <span className={`absolute -bottom-3 left-1/2 h-3 w-1 -translate-x-1/2 ${color}`} />
      <span className={`absolute top-1/2 -left-3 h-1 w-3 -translate-y-1/2 ${color}`} />
      <span className={`absolute top-1/2 -right-3 h-1 w-3 -translate-y-1/2 ${color}`} />
    </motion.span>
  )
}

const TRAIL = [3, 2, 1, 0] as const

/** The spinning dagger on its way, with a fading trail behind it. */
function FlyingDagger({ from, to, yours }: Flight) {
  const spin = to.x > from.x ? 900 : -900
  return (
    <>
      {TRAIL.map((index) => (
        <motion.img
          key={index}
          src={DAGGER_ICON}
          alt={index === 0 ? 'Dagger' : ''}
          initial={{ ...placeAt(from), rotate: 0, opacity: 0, scale: 1 - index * 0.16 }}
          animate={{ ...placeAt(to), rotate: spin, opacity: index === 0 ? 1 : 0.55 - index * 0.13 }}
          transition={{
            delay: LAUNCH_DELAY_S + index * TRAIL_GAP_S,
            duration: FLIGHT_S,
            ease: 'linear',
            opacity: { delay: LAUNCH_DELAY_S + index * TRAIL_GAP_S, duration: 0.06 },
          }}
          className={`pointer-events-none absolute z-20 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
            yours ? 'border-hextech shadow-[0_0_16px_rgb(10_200_185/0.9)]' : 'border-red-400 shadow-[0_0_16px_rgb(248_113_113/0.9)]'
          } ${index > 0 ? 'blur-[1px]' : ''}`}
        />
      ))}
    </>
  )
}

/** The landing: a hit with a burst and the damage, or a whiff past an empty spot. */
function DaggerLanding({ from, to, hit, yours }: Flight) {
  const spin = to.x > from.x ? 1 : -1
  if (!hit) {
    const past = { x: to.x + (to.x - from.x) * 0.35, y: to.y + (to.y - from.y) * 0.35 }
    return (
      <>
        <motion.img
          src={DAGGER_ICON}
          alt=""
          initial={{ ...placeAt(to), rotate: spin * 900, opacity: 1 }}
          animate={{ ...placeAt(past), rotate: spin * 1260, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'linear' }}
          className="pointer-events-none absolute z-20 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full"
        />
        <Whiff point={to} />
      </>
    )
  }
  return (
    <>
      <motion.span
        initial={{ scale: 0.5, opacity: 1 }}
        animate={{ scale: 2.4, opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={placeAt(to)}
        className="pointer-events-none absolute z-20 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-red-500"
        aria-hidden="true"
      />
      <motion.img
        src={DAGGER_ICON}
        alt=""
        initial={{ scale: 1.6, rotate: spin * 900, opacity: 1 }}
        animate={{ scale: 1, rotate: spin * 930, opacity: [1, 1, 0] }}
        transition={{ type: 'spring', stiffness: 400, damping: 12, opacity: { duration: 0.9, times: [0, 0.75, 1] } }}
        style={placeAt(to)}
        className="pointer-events-none absolute z-20 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-300"
      />
      <motion.span
        initial={{ y: -8, scale: 1.8, opacity: 0 }}
        animate={{ y: -64, scale: 1, opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        style={placeAt(to)}
        className={`pointer-events-none absolute z-30 -translate-x-1/2 font-display text-3xl font-black drop-shadow-[0_2px_4px_rgb(0_0_0/0.9)] [-webkit-text-stroke:1px_rgb(1_10_19/0.8)] ${
          yours ? 'text-gold' : 'text-red-500'
        }`}
        aria-hidden="true"
      >
        -{DAMAGE}
      </motion.span>
    </>
  )
}

/** A swoosh where the dagger went through nobody. */
function Whiff({ point }: { point: Point }) {
  return (
    <>
      <motion.span
        initial={{ rotate: -50, scale: 0.7, opacity: 0.9 }}
        animate={{ rotate: 50, scale: 1.4, opacity: 0 }}
        transition={{ duration: 0.5 }}
        style={placeAt(point)}
        className="pointer-events-none absolute z-20 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-t-4 border-gold-light/70"
        aria-hidden="true"
      />
      <motion.span
        initial={{ y: 0, opacity: 0, scale: 0.6 }}
        animate={{ y: -40, opacity: [0, 1, 0], scale: 1.1 }}
        transition={{ duration: 0.8 }}
        style={placeAt(point)}
        className="pointer-events-none absolute z-30 -translate-x-1/2 font-display text-lg font-black text-gold-light/80 italic"
        aria-hidden="true"
      >
        whiff
      </motion.span>
    </>
  )
}

/** Covers the arena for a call: the THROW / DODGE banner (dimmed) or the turn's result. */
function Overlay({ dim = false, children }: { dim?: boolean; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={`pointer-events-none absolute inset-0 z-40 flex items-center justify-center p-2 ${dim ? 'bg-abyss/60' : ''}`}
    >
      {children}
    </motion.div>
  )
}

/** "You THROW" or "You DODGE", in your blue, for the whole turn. */
function RoleLabel({ youThrow }: { youThrow: boolean }) {
  return (
    <motion.p
      key={youThrow ? 'throw' : 'dodge'}
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex items-center gap-2 text-hextech"
    >
      {youThrow ? (
        <img src={DAGGER_ICON} alt="" className="size-7 rounded-full border-2 border-hextech" />
      ) : (
        <DodgeArrows className="h-7 w-5" />
      )}
      <span className="text-sm font-semibold">You</span>
      <span className="font-display text-2xl font-black tracking-wider">{youThrow ? 'THROW' : 'DODGE'}</span>
    </motion.p>
  )
}

function DodgeArrows({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 20 28"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 3v22M4 9l6-6 6 6M4 19l6 6 6-6" />
    </svg>
  )
}

function TurnCounter({ turn, max }: { turn: number; max: number }) {
  return (
    <div className="flex flex-col items-center leading-tight" aria-label={`Turn ${turn} of ${max}`}>
      <span className="text-[10px] tracking-widest text-gold-light/50 uppercase">Turn</span>
      <span className="font-mono text-sm text-gold-light/80 tabular-nums">
        {turn}/{max}
      </span>
    </div>
  )
}

/** Health in three chunks: each dagger takes one. */
function HealthBar({ name, taken, side }: { name: string; taken: number; side: Side }) {
  const yours = side === 'me'
  const left = Math.max(0, CLEAVER_HITS_TO_WIN - taken)
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${yours ? '' : 'items-end text-right'}`}>
      <span className={`max-w-full truncate text-xs font-semibold ${yours ? 'text-hextech' : 'text-red-400'}`}>{name}</span>
      <div className="relative h-5 w-full overflow-hidden rounded-sm border border-black bg-black/80">
        <motion.div
          className={`absolute inset-y-0 ${
            yours ? 'left-0 bg-linear-to-b from-hextech to-cyan-800' : 'right-0 bg-linear-to-b from-red-400 to-red-700'
          }`}
          initial={false}
          animate={{ width: `${(left / CLEAVER_HITS_TO_WIN) * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        />
        {Array.from({ length: CLEAVER_HITS_TO_WIN - 1 }, (_, index) => (
          <span key={index} className="absolute inset-y-0 w-0.5 bg-black/80" style={{ left: `${((index + 1) / CLEAVER_HITS_TO_WIN) * 100}%` }} />
        ))}
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-bold text-white drop-shadow">
          {left * DAMAGE} / {MAX_HP}
        </span>
      </div>
    </div>
  )
}

/** 1: a dagger flying at one of their three spots. 2: from top, only top and mid. 3: three hits empty the bar. */
export function CleaverTutorialArt({ step }: TutorialArtProps) {
  if (step === 0) return <ThrowArt />
  if (step === 1) return <DodgeArt />
  return <HitsArt />
}

const ART_ICON = 'absolute -translate-x-1/2 -translate-y-1/2 rounded-full'

function ThrowArt() {
  return (
    <div className="relative size-full bg-linear-to-r from-cyan-950/70 to-red-950/70">
      <img src={championIconById(MINI_GAMES.cleaver.champion)} alt="" style={placeAt({ x: 17, y: 50 })} className={`${ART_ICON} size-[26%] border-2 border-hextech`} />
      {ALL_SPOTS.map((spot) => (
        <span
          key={spot}
          style={placeAt({ x: 78, y: spotY(spot) })}
          className={`${ART_ICON} size-[24%] border-2 ${spot === 0 ? 'border-red-400 bg-red-500/30' : 'border-gold/40 bg-abyss/40'}`}
        />
      ))}
      <motion.img
        src={DAGGER_ICON}
        alt=""
        initial={placeAt({ x: 26, y: 50 })}
        animate={{ left: ['26%', '78%'], top: ['50%', `${spotY(0)}%`], rotate: [0, 720], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 0.5, ease: 'linear' }}
        className={`${ART_ICON} size-[20%] border border-red-300`}
      />
    </div>
  )
}

function DodgeArt() {
  return (
    <div className="relative size-full bg-linear-to-b from-cyan-950/50 to-slate-900/70">
      {ALL_SPOTS.map((spot) => (
        <span
          key={spot}
          style={placeAt({ x: 42, y: spotY(spot) })}
          className={`${ART_ICON} size-[27%] border-2 ${
            spot === 2 ? 'border-gold/15 opacity-40' : 'border-hextech bg-hextech/20 shadow-[0_0_10px_rgb(10_200_185/0.7)]'
          }`}
        />
      ))}
      <motion.img
        src={championIconById(MINI_GAMES.cleaver.champion)}
        alt=""
        initial={placeAt({ x: 42, y: spotY(0) })}
        animate={{ top: [`${spotY(0)}%`, `${spotY(0)}%`, `${spotY(1)}%`, `${spotY(1)}%`] }}
        transition={{ duration: 1.8, times: [0, 0.35, 0.55, 1], repeat: Infinity, repeatType: 'reverse' }}
        className={`${ART_ICON} size-[22%] border-2 border-hextech`}
      />
      <motion.span
        animate={{ y: [0, 4, 0] }}
        transition={{ duration: 0.9, repeat: Infinity }}
        style={placeAt({ x: 80, y: 33 })}
        className="absolute size-[30%] -translate-x-1/2 -translate-y-1/2 text-hextech"
      >
        <DodgeArrows className="size-full" />
      </motion.span>
    </div>
  )
}

const HIT_TIMES = [0.2, 0.45, 0.7] as const

function HitsArt() {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-[10%] bg-linear-to-b from-slate-900/40 to-red-950/50 px-[10%]">
      <div className="flex w-full justify-center gap-[8%]">
        {HIT_TIMES.map((at) => (
          <motion.img
            key={at}
            src={DAGGER_ICON}
            alt=""
            animate={{ scale: [0.7, 0.7, 1.3, 1, 1], opacity: [0.3, 0.3, 1, 1, 1] }}
            transition={{ duration: 3, times: [0, at, at + 0.05, at + 0.1, 1], repeat: Infinity }}
            className="aspect-square w-[26%] rounded-full border border-red-300"
          />
        ))}
      </div>
      <div className="relative flex h-[14%] w-full gap-0.5 overflow-hidden rounded-sm border border-black bg-black/80 p-px">
        {[...HIT_TIMES].reverse().map((at) => (
          <motion.span
            key={at}
            animate={{ opacity: [1, 1, 0.1, 0.1] }}
            transition={{ duration: 3, times: [0, at + 0.03, at + 0.08, 1], repeat: Infinity }}
            className="flex-1 bg-linear-to-b from-red-400 to-red-700"
          />
        ))}
      </div>
    </div>
  )
}
