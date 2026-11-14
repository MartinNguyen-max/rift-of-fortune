import { motion, type TargetAndTransition } from 'framer-motion'
import { useCallback, useId, useMemo, useRef, type ReactNode } from 'react'
import { MINI_GAMES } from '../../game/minigames/catalog'
import {
  BUSHES,
  gankHalves,
  gankPoints,
  gankResults,
  NO_GUESS,
  PICK_SECONDS,
  type Bush,
  type GankHalf,
} from '../../game/minigames/gank'
import { other, type Player } from '../../game/minigames/versus'
import {
  BEAT,
  bushOf,
  gankPhase,
  halfCall,
  scorerOf,
  useBushKeys,
  useRevealCursor,
  type Beat,
  type GankPhase,
  type HalfCall,
} from './gankScreen'
import { championIconById } from './miniGameArt'
import { BigCall, ChoiceTimer, ContestantTag, Waiting } from './parts'
import { useShownWhen } from './timing'
import type { Contestant, MiniGameViewProps, RevealProps, TutorialArtProps } from './types'

/** The three bushes, left to right: top, mid, bot. */
const BUSH_SPOTS = [0, 1, 2] as const satisfies readonly Bush[]
/** A hider out of time stays in the middle bush. */
const TIMEOUT_BUSH: Bush = 1
/** How long the last call stays up before Victory or Defeat covers it. */
const LAST_CALL_HOLD_MS = 2200

type Players = readonly [Contestant, Contestant]
type HiderState = 'sunk' | 'caught' | 'popped'
type GuessState = 'aim' | 'hit' | 'miss'

/** The champion in a bush: down in it, pulled half out (found), or jumped right out (not found). */
interface HiderSpot {
  bush: Bush
  contestant: Contestant
  you: boolean
  state: HiderState
}

/** The bush someone guessed. */
interface GuessSpot {
  bush: Bush
  contestant: Contestant
  you: boolean
  state: GuessState
}

interface Scene {
  hider: HiderSpot | null
  guess: GuessSpot | null
}

const EMPTY_SCENE: Scene = { hider: null, guess: null }

/** Shaco vs Rengar: hide your jungler in a bush, then guess the bush they hide in. A right guess scores. */
export function GankGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const halves = gankHalves(setup)
  const results = useMemo(() => gankResults(moves, setup), [moves, setup])
  const { half, beat, revealing } = useRevealCursor(results.length, setup, me)
  const phase = gankPhase(half, me, moves, setup, revealing)
  const current = revealing ? results[half] : undefined
  const call = current && beat >= BEAT.called ? halfCall(current, me) : null
  const scored = results.slice(0, call ? half + 1 : half)
  const points = gankPoints(scored)
  useShownWhen(call !== null && half === halves - 1, onShown, LAST_CALL_HOLD_MS)

  const sentHalf = useRef(-1)
  const pick = useCallback(
    (move: number) => {
      if (sentHalf.current === half) return
      sentHalf.current = half
      sendMove(half, move)
    },
    [half, sendMove],
  )
  const picking = phase === 'hide' || phase === 'guess'
  useBushKeys(pick, picking)

  const scene: Scene = current
    ? revealScene(current, beat, me, players)
    : phase === 'hidden'
      ? { hider: { bush: bushOf(moves[me][half]), contestant: players[me], you: true, state: 'sunk' }, guess: null }
      : EMPTY_SCENE
  const seconds = PICK_SECONDS[setup.variant]

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ScoreTag contestant={players[me]} you points={points[me]} />
        <HalfDots halves={halves} scored={scored} current={half} me={me} />
        <ScoreTag contestant={players[them]} you={false} points={points[them]} />
      </div>
      <div className="flex h-14 w-full items-center justify-center">
        {phase === 'hide' && <ChoiceTimer key={`hide-${half}`} seconds={seconds} label="Hide" onTimeout={() => pick(TIMEOUT_BUSH)} />}
        {phase === 'guess' && <ChoiceTimer key={`guess-${half}`} seconds={seconds} label="Guess" onTimeout={() => pick(NO_GUESS)} />}
        {(phase === 'hidden' || phase === 'waitHide') && <Waiting name={players[them].name} />}
      </div>
      <Field
        key={half}
        scene={scene}
        onPick={picking ? pick : null}
        pickVerb={phase === 'hide' ? 'Hide in' : 'Guess'}
        frame={call?.tone ?? null}
        top={<FieldTop phase={phase} call={call} result={current} me={me} players={players} />}
      />
      <p className="hidden text-sm text-gold-light/60 sm:block">Click a bush or press 1, 2, 3</p>
    </div>
  )
}

/** What a finished half shows at each beat: the guess lands, then the hider pops out of their bush. */
function revealScene(result: GankHalf, beat: Beat, me: Player, players: Players): Scene {
  const guesser = other(result.hider)
  const popped = beat >= BEAT.popped
  const hider: HiderSpot | null =
    popped || result.hider === me
      ? {
          bush: result.bush,
          contestant: players[result.hider],
          you: result.hider === me,
          state: popped ? (result.found ? 'caught' : 'popped') : 'sunk',
        }
      : null
  const guess: GuessSpot | null =
    result.guess !== null && (beat >= BEAT.guessed || guesser === me)
      ? {
          bush: result.guess,
          contestant: players[guesser],
          you: guesser === me,
          state: popped ? (result.found ? 'hit' : 'miss') : 'aim',
        }
      : null
  return { hider, guess }
}

function ScoreTag({ contestant, you, points }: { contestant: Contestant; you: boolean; points: number }) {
  return (
    <motion.div
      key={points}
      className={`min-w-0 ${you ? 'origin-left' : 'origin-right'}`}
      initial={points > 0 ? { scale: 1.35 } : false}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 12 }}
    >
      <ContestantTag contestant={contestant} you={you} value={`${points}`} />
    </motion.div>
  )
}

/** One dot per half: gold for your point, red for theirs. */
function HalfDots({ halves, scored, current, me }: { halves: number; scored: readonly GankHalf[]; current: number; me: Player }) {
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={`Round ${current + 1} of ${halves}`}>
      {Array.from({ length: halves }, (_, index) => {
        const result = scored[index]
        const color = result
          ? scorerOf(result) === me
            ? 'border-gold bg-gold'
            : 'border-red-400 bg-red-400'
          : index === current
            ? 'border-gold-light'
            : 'border-gold/40'
        return <span key={index} className={`size-3 rounded-full border-2 ${color}`} />
      })}
    </div>
  )
}

interface FieldTopProps {
  phase: GankPhase
  call: HalfCall | null
  result: GankHalf | undefined
  me: Player
  players: Players
}

/** Above the bushes: your role (HIDE or GUESS), them sneaking around, or the half's result. */
function FieldTop({ phase, call, result, me, players }: FieldTopProps) {
  const them = players[other(me)]
  if (phase === 'hide') return <RoleCall contestant={players[me]} mine word="HIDE" />
  if (phase === 'guess') return <RoleCall contestant={them} mine={false} word="GUESS" />
  if (phase === 'waitHide') return <Sneaking contestant={them} />
  if (!call || !result) return null
  const noGuess = result.guess === null ? 'No guess · ' : ''
  return <BigCall text={call.text} tone={call.tone} size="large" sub={`${noGuess}+1 ${players[call.scorer].name}`} />
}

/** Your champion bobbing over HIDE, or theirs (a mystery) over GUESS. */
function RoleCall({ contestant, mine, word }: { contestant: Contestant; mine: boolean; word: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.span
        className="relative block"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <img
          src={championIconById(contestant.champion)}
          alt=""
          className={`size-12 rounded-full border-2 sm:size-16 ${mine ? 'border-hextech' : 'border-red-400 brightness-50 grayscale'}`}
        />
        {!mine && (
          <span className="absolute inset-0 flex items-center justify-center font-display text-3xl font-black text-gold-light">?</span>
        )}
      </motion.span>
      <BigCall text={word} tone="you" size="large" />
    </div>
  )
}

/** The opponent creeping between the bushes while they choose one. */
function Sneaking({ contestant }: { contestant: Contestant }) {
  return (
    <motion.img
      src={championIconById(contestant.champion)}
      alt=""
      className="mt-10 size-12 rounded-full border-2 border-red-400 opacity-60 grayscale"
      animate={{ x: [-90, 90, -90] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

const FRAME = {
  win: 'border-gold',
  lose: 'border-red-500',
  none: 'border-emerald-700/50',
} as const

interface FieldProps {
  scene: Scene
  /** Set while you choose a bush. */
  onPick: ((bush: Bush) => void) | null
  pickVerb: string
  /** Lights the frame with the half's result. */
  frame: HalfCall['tone'] | null
  top: ReactNode
}

/** The jungle at night: something on top, three bushes along the bottom. */
function Field({ scene, onPick, pickVerb, frame, top }: FieldProps) {
  return (
    <div
      className={`relative h-80 w-full overflow-hidden rounded-lg border-2 bg-linear-to-b from-teal-950 via-emerald-950/70 to-abyss transition-colors duration-300 sm:h-96 ${FRAME[frame ?? 'none']}`}
    >
      <span className="absolute -top-20 left-1/2 size-56 -translate-x-1/2 rounded-full bg-hextech/10 blur-3xl" aria-hidden="true" />
      <span className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/50 to-transparent" aria-hidden="true" />
      <motion.div className="relative flex h-full flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex min-h-0 flex-1 justify-center pt-3">{top}</div>
        <div className="grid grid-cols-3 gap-2 px-1 pb-1.5 sm:gap-6 sm:px-6">
          {BUSH_SPOTS.map((bush) => (
            <BushSpot
              key={bush}
              bush={bush}
              hider={scene.hider?.bush === bush ? scene.hider : null}
              guess={scene.guess?.bush === bush ? scene.guess : null}
              onPick={onPick}
              pickVerb={pickVerb}
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}

interface BushSpotProps {
  bush: Bush
  hider: HiderSpot | null
  guess: GuessSpot | null
  onPick: ((bush: Bush) => void) | null
  pickVerb: string
}

function BushSpot({ bush, hider, guess, onPick, pickVerb }: BushSpotProps) {
  const lane = BUSHES[bush]
  const rustle = hider?.state ?? (guess?.state === 'miss' ? 'miss' : null)
  return (
    <button
      type="button"
      disabled={!onPick}
      onClick={() => onPick?.(bush)}
      aria-label={onPick ? `${pickVerb} ${lane} bush` : `${lane} bush`}
      className="group flex w-full touch-manipulation flex-col items-center gap-0.5 rounded-lg select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hextech enabled:cursor-pointer"
    >
      <span className={`relative block h-32 w-full transition sm:h-40 ${onPick ? 'group-hover:brightness-125 group-active:scale-95' : ''}`}>
        {onPick && <PickGlow />}
        <BushArt rustle={rustle} sway={bush * 0.7}>
          {hider && <Hider contestant={hider.contestant} you={hider.you} state={hider.state} />}
        </BushArt>
        {guess && <GuessMark contestant={guess.contestant} you={guess.you} state={guess.state} />}
      </span>
      <span className="text-[11px] font-bold tracking-widest text-gold-light/60 uppercase sm:text-xs">{lane}</span>
    </button>
  )
}

/** A soft pulse under each bush you can pick. */
function PickGlow() {
  return (
    <motion.span
      className="absolute inset-x-1 bottom-0 block h-3/5 rounded-[50%] bg-hextech/30 blur-md"
      animate={{ opacity: [0.3, 0.9, 0.3] }}
      transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden="true"
    />
  )
}

/** Where the hider sits, as a share of their own size. */
const HIDER_Y: Record<HiderState, string> = { sunk: '0%', caught: '-95%', popped: '-125%' }

/** The hider's icon between the back and front leaves: drops in, or springs out on the reveal. */
function Hider({ contestant, you, state }: Omit<HiderSpot, 'bush'>) {
  return (
    <span className="pointer-events-none absolute inset-x-0 top-[40%] z-10 flex justify-center">
      <motion.span
        className="relative block size-14 sm:size-20"
        initial={state === 'sunk' ? { y: '-160%', opacity: 1 } : { y: '20%', opacity: 0 }}
        animate={{ y: HIDER_Y[state], opacity: 1, scale: state === 'popped' ? 1.08 : 1 }}
        transition={{
          type: 'spring',
          stiffness: state === 'sunk' ? 240 : 520,
          damping: state === 'sunk' ? 18 : 12,
          opacity: { duration: 0.1 },
        }}
      >
        <img
          src={championIconById(contestant.champion)}
          alt={contestant.name}
          draggable={false}
          className={`size-full rounded-full border-[3px] shadow-lg shadow-black/60 ${you ? 'border-hextech' : 'border-red-400'}`}
        />
        {state === 'caught' && <ClawMarks />}
        {state === 'popped' && <SpeechBubble text="I was hiding!" />}
      </motion.span>
    </span>
  )
}

function SpeechBubble({ text }: { text: string }) {
  return (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.2, type: 'spring', stiffness: 420, damping: 16 }}
      className="absolute bottom-full left-1/2 mb-2 block origin-bottom -translate-x-1/2 rounded-lg bg-gold-light px-1.5 py-0.5 text-[11px] font-black whitespace-nowrap text-abyss shadow-md shadow-black/50 sm:px-2 sm:text-sm"
    >
      {text}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-gold-light" />
    </motion.span>
  )
}

/** Three slashes across a hider who got found. */
function ClawMarks() {
  return (
    <svg viewBox="0 0 40 40" className="absolute inset-0 size-full overflow-visible drop-shadow-[0_0_4px_rgb(239_68_68)]" aria-hidden="true">
      {[-9, 0, 9].map((offset, index) => (
        <motion.path
          key={offset}
          d={`M${9 + offset} 8L${27 + offset} 32`}
          stroke="white"
          strokeWidth={2.5}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.15 + index * 0.07, duration: 0.16 }}
        />
      ))}
    </svg>
  )
}

/** The guess: a target that locks onto a bush. Gold when it finds you a hider, faded with an ✕ when the bush was empty. */
function GuessMark({ contestant, you, state }: Omit<GuessSpot, 'bush'>) {
  const color = !you ? 'text-red-400' : state === 'hit' ? 'text-gold' : 'text-hextech'
  return (
    <span className="pointer-events-none absolute inset-x-0 top-[40%] z-30 flex justify-center">
      <motion.span
        className={`relative block size-14 sm:size-20 ${color}`}
        initial={{ scale: 2.2, opacity: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0, opacity: state === 'miss' ? 0.6 : 1, y: state === 'hit' ? HIDER_Y.caught : '0%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 20, opacity: { duration: 0.2 } }}
      >
        <span className="absolute -inset-2.5 block">
          <Reticle />
        </span>
        {state === 'hit' && (
          <motion.span
            className="absolute -inset-2.5 block rounded-full border-4 border-current"
            initial={{ scale: 1, opacity: 0.9 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 0.7, repeat: 2, delay: 0.1 }}
          />
        )}
        {state === 'miss' && (
          <span className="absolute inset-0 flex items-center justify-center font-display text-3xl font-black">✕</span>
        )}
        <img
          src={championIconById(contestant.champion)}
          alt=""
          className={`absolute -right-2.5 -bottom-2.5 size-6 rounded-full border-2 sm:size-7 ${you ? 'border-hextech' : 'border-red-400'}`}
        />
      </motion.span>
    </span>
  )
}

const RETICLE_TICKS = [
  [50, -4, 50, 16],
  [50, 84, 50, 104],
  [-4, 50, 16, 50],
  [84, 50, 104, 50],
] as const

function Reticle() {
  return (
    <svg viewBox="0 0 100 100" className="size-full overflow-visible drop-shadow-[0_0_6px_currentColor]" aria-hidden="true">
      <circle cx={50} cy={50} r={42} fill="none" stroke="currentColor" strokeWidth={6} strokeDasharray="22 11" />
      {RETICLE_TICKS.map(([x1, y1, x2, y2]) => (
        <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={6} strokeLinecap="round" />
      ))}
    </svg>
  )
}

type Rustle = HiderState | 'miss'

interface BushArtProps {
  /** Whoever hides in the bush, drawn between the back and the front leaves. */
  children?: ReactNode
  /** Shakes the leaves (and throws a few) each time it changes. */
  rustle?: Rustle | null
  /** Seconds to offset the idle sway so bushes don't move in step, or null to stand still. */
  sway?: number | null
}

/** A drawn bush filling its positioned parent. */
function BushArt({ children, rustle = null, sway = 0 }: BushArtProps) {
  return (
    <span className="absolute inset-0 block">
      <Leaves layer="back" rustle={rustle} sway={sway} />
      {children}
      <Leaves layer="front" rustle={rustle} sway={sway} />
      {rustle && <LeafBurst key={rustle} />}
    </span>
  )
}

/** A blade of grass growing from the ground: where it starts, where its tip is, half its width at the ground. */
type Leaf = readonly [baseX: number, tipX: number, tipY: number, halfWidth: number]

/** The leaves live in a 120 × 100 box; the ground is its bottom edge. */
const GROUND = 100

interface LeafLayer {
  leaves: readonly Leaf[]
  /** Tip to base. */
  colors: readonly [string, string, string]
  mound: string
  moundPath: string
  z: string
  sway: TargetAndTransition
}

/** Tall dark blades at the back, short bright ones in front so the hider peeks between them. */
const LEAF_LAYERS: Record<'back' | 'front', LeafLayer> = {
  back: {
    leaves: [
      [34, 8, 48, 9],
      [40, 18, 26, 10],
      [46, 30, 10, 10],
      [54, 46, 2, 10],
      [62, 64, 0, 11],
      [70, 80, 6, 10],
      [76, 94, 16, 10],
      [82, 104, 30, 10],
      [88, 114, 50, 9],
    ],
    colors: ['#43c08e', '#1c7a55', '#0a3a2a'],
    mound: '#0b3d2c',
    moundPath: `M12 ${GROUND}Q60 40 108 ${GROUND}Z`,
    z: 'z-0',
    sway: { rotate: [-1.5, 1.5, -1.5] },
  },
  front: {
    leaves: [
      [30, 6, 74, 9],
      [36, 14, 60, 10],
      [44, 28, 50, 10],
      [52, 44, 44, 11],
      [62, 62, 42, 11],
      [70, 78, 46, 10],
      [78, 94, 54, 10],
      [86, 108, 62, 9],
      [92, 116, 76, 8],
    ],
    colors: ['#8be6a8', '#33975f', '#155034'],
    mound: '#165836',
    moundPath: `M6 ${GROUND}Q60 64 114 ${GROUND}Z`,
    z: 'z-20',
    sway: { skewX: [2.5, -2.5, 2.5] },
  },
}

const RUSTLE: TargetAndTransition = { rotate: [0, -8, 6, -4, 2, 0], y: [0, -3, 0, 0, 0, 0] }

function leafPath([baseX, tipX, tipY, halfWidth]: Leaf): string {
  const lean = (tipX - baseX) * 0.4
  const midY = (GROUND + tipY) / 2
  return `M${baseX - halfWidth} ${GROUND}Q${baseX - halfWidth * 0.5 + lean} ${midY} ${tipX} ${tipY}Q${baseX + halfWidth * 0.9 + lean} ${midY} ${baseX + halfWidth} ${GROUND}Z`
}

const veinPath = ([baseX, tipX, tipY]: Leaf): string =>
  `M${baseX} ${GROUND}Q${baseX + (tipX - baseX) * 0.4} ${(GROUND + tipY) / 2} ${tipX} ${tipY}`

function Leaves({ layer, rustle, sway }: { layer: keyof typeof LEAF_LAYERS; rustle: Rustle | null; sway: number | null }) {
  const gradient = `leaves${useId().replace(/[^\w-]/g, '')}`
  const { leaves, colors, mound, moundPath, z, sway: swayFrames } = LEAF_LAYERS[layer]
  return (
    <motion.span
      className={`pointer-events-none absolute inset-0 block origin-bottom ${z}`}
      animate={sway === null ? undefined : swayFrames}
      transition={{ duration: 3.4, delay: sway ?? 0, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.span
        key={rustle ?? 'still'}
        className="block size-full origin-bottom"
        animate={rustle ? RUSTLE : undefined}
        transition={{ duration: 0.6 }}
      >
        <svg viewBox={`0 0 120 ${GROUND}`} preserveAspectRatio="none" className="size-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              {colors.map((color, index) => (
                <stop key={color} offset={index / (colors.length - 1)} stopColor={color} />
              ))}
            </linearGradient>
          </defs>
          {layer === 'back' && <ellipse cx={60} cy={GROUND - 2} rx={52} ry={4} fill="black" fillOpacity={0.4} />}
          <path d={moundPath} fill={mound} />
          {leaves.map((leaf) => (
            <path key={leaf.join()} d={leafPath(leaf)} fill={`url(#${gradient})`} />
          ))}
          {leaves.map((leaf) => (
            <path
              key={`vein${leaf.join()}`}
              d={veinPath(leaf)}
              fill="none"
              stroke={colors[0]}
              strokeOpacity={0.35}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </motion.span>
    </motion.span>
  )
}

/** Leaves flying off a bush that just rustled: x, y and spin of each. */
const BURST = [
  [-30, -34, -70],
  [-14, -50, -25],
  [4, -56, 15],
  [20, -46, 50],
  [34, -28, 95],
] as const

function LeafBurst() {
  return (
    <span className="pointer-events-none absolute inset-x-0 top-[45%] z-30 flex justify-center" aria-hidden="true">
      {BURST.map(([x, y, rotate]) => (
        <motion.span
          key={x}
          className="absolute block h-2 w-3.5 rounded-[100%_0] bg-emerald-300"
          initial={{ x: 0, y: 0, rotate: 0, scale: 0.6, opacity: 1 }}
          animate={{ x, y, rotate, scale: 1, opacity: 0 }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
        />
      ))}
    </span>
  )
}

/** Each half as a small picture: the hider over the bush they hid in, the guessed bush boxed, and who got the point. */
export function GankReveal({ setup, me, moves, players }: RevealProps) {
  const results = gankResults(moves, setup)
  const compact = results.length > 2
  return (
    <div className={`grid w-full gap-1.5 ${compact ? 'max-w-80 grid-cols-2' : 'max-w-60'}`}>
      {results.map((result, half) => (
        <HalfPicture key={half} result={result} me={me} players={players} compact={compact} />
      ))}
    </div>
  )
}

function describeHalf(result: GankHalf, players: Players): string {
  const guesser = players[other(result.hider)].name
  const guessed = result.guess === null ? `${guesser} didn't guess` : `${guesser} guessed ${BUSHES[result.guess]}`
  return `${players[result.hider].name} hid ${BUSHES[result.bush]}, ${guessed}: +1 ${players[scorerOf(result)].name}`
}

function HalfPicture({ result, me, players, compact }: { result: GankHalf; me: Player; players: Players; compact: boolean }) {
  const scorer = scorerOf(result)
  const guesserIsYou = other(result.hider) === me
  return (
    <div
      role="img"
      aria-label={describeHalf(result, players)}
      className={`flex items-center gap-1 rounded-md border bg-teal-950/70 p-1 ${scorer === me ? 'border-gold/70' : 'border-red-400/60'}`}
    >
      <div className="grid flex-1 grid-cols-3 gap-0.5">
        {BUSH_SPOTS.map((bush) => (
          <div
            key={bush}
            className={`flex flex-col items-center rounded-md border-2 px-0.5 pt-0.5 ${
              result.guess === bush ? (guesserIsYou ? 'border-hextech' : 'border-red-400') : 'border-transparent'
            }`}
          >
            <img
              src={championIconById(players[result.hider].champion)}
              alt=""
              className={`rounded-full border-2 ${compact ? 'size-5' : 'size-8'} ${result.hider === me ? 'border-hextech' : 'border-red-400'} ${
                result.bush === bush ? '' : 'invisible'
              }`}
            />
            <span className={`relative -mt-1 block w-full ${compact ? 'h-4' : 'h-7'}`}>
              <BushArt sway={null} />
            </span>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 flex-col items-center">
        <img
          src={championIconById(players[scorer].champion)}
          alt=""
          className={`rounded-full border ${compact ? 'size-4' : 'size-6'} ${scorer === me ? 'border-hextech' : 'border-red-400'}`}
        />
        <span className={`font-display text-xs font-black ${scorer === me ? 'text-gold' : 'text-red-400'}`}>+1</span>
      </div>
    </div>
  )
}

/** The three bushes of a tutorial picture, with something inside or over any of them. */
function TutorialBushes({ inside, over }: { inside?: Partial<Record<Bush, ReactNode>>; over?: Partial<Record<Bush, ReactNode>> }) {
  return (
    <div className="flex size-full items-end bg-linear-to-b from-teal-950 to-emerald-950/80 px-1 pb-2">
      <div className="grid w-full grid-cols-3 gap-0.5">
        {BUSH_SPOTS.map((bush) => (
          <span key={bush} className="relative block h-11 sm:h-14">
            <BushArt sway={bush * 0.5}>{inside?.[bush]}</BushArt>
            {over?.[bush]}
          </span>
        ))}
      </div>
    </div>
  )
}

/** 1: Shaco peeking out of a bush. 2: a tap on one bush, question marks over the others. 3: Rengar found, +1. */
export function GankTutorialArt({ step }: TutorialArtProps) {
  if (step === 0) {
    return (
      <TutorialBushes
        inside={{
          1: (
            <span className="absolute inset-x-0 top-[25%] z-10 flex justify-center">
              <motion.img
                src={championIconById(MINI_GAMES.gank.champion)}
                alt=""
                className="size-7 rounded-full border-2 border-hextech sm:size-9"
                animate={{ y: ['45%', '-15%', '45%'] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            </span>
          ),
        }}
      />
    )
  }
  if (step === 1) {
    const question = <span className="absolute inset-x-0 -top-6 text-center font-display text-xl font-black text-gold-light/80">?</span>
    return (
      <TutorialBushes
        over={{
          0: question,
          2: question,
          1: (
            <>
              <span className="absolute inset-x-0 top-[15%] z-30 flex justify-center">
                <motion.span
                  className="relative block size-7 text-hextech sm:size-9"
                  animate={{ scale: [1.3, 1, 1.3] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  <span className="absolute -inset-1 block">
                    <Reticle />
                  </span>
                </motion.span>
              </span>
              <motion.span
                className="absolute -right-2 -bottom-1 z-30 text-lg sm:text-xl"
                animate={{ y: [4, -2, 4] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                👆
              </motion.span>
            </>
          ),
        }}
      />
    )
  }
  return (
    <div className="relative flex size-full items-end justify-center bg-linear-to-b from-teal-950 to-emerald-950/80 pb-2">
      <motion.span
        className="absolute top-1.5 right-2 font-display text-xl font-black text-gold drop-shadow-[0_1px_2px_black] sm:text-2xl"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        +1
      </motion.span>
      <span className="relative block h-14 w-3/5 sm:h-20">
        <BushArt sway={0}>
          <span className="absolute inset-x-0 top-0 z-10 flex justify-center">
            <img src={championIconById(MINI_GAMES.gank.botChampion)} alt="" className="size-9 rounded-full border-2 border-red-400 sm:size-12" />
          </span>
        </BushArt>
        <span className="absolute inset-x-0 top-0 z-30 flex justify-center">
          <span className="relative block size-9 text-gold sm:size-12">
            <span className="absolute -inset-1.5 block">
              <Reticle />
            </span>
          </span>
        </span>
      </span>
    </div>
  )
}
