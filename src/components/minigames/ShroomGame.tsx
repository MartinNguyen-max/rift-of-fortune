import { motion, useAnimate } from 'framer-motion'
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { spellIconUrl } from '../../data'
import { MINI_GAMES } from '../../game/minigames/catalog'
import {
  emptyPlan,
  encodePlan,
  encodeStep,
  halfMoves,
  halfResults,
  isPlanReady,
  PATH_STEPS,
  PLANT_SECONDS,
  pointsOf,
  SHROOM_COUNT,
  SHROOM_RULES,
  shroomsPlaced,
  SIDES,
  slotOf,
  STEP_SECONDS,
  toggleShroom,
  walkPath,
  walkPoints,
  type HalfMoves,
  type HalfResult,
  type ShroomPlan,
  type Side,
  type WalkResult,
} from '../../game/minigames/shrooms'
import { other, type GameSetup, type Player } from '../../game/minigames/versus'
import { Button } from '../Button'
import { championIconById } from './miniGameArt'
import { BigCall, ChoiceTimer, ContestantTag, Waiting, type Tone } from './parts'
import { revealedShrooms, timeoutPlan, timeoutSide, useHops, useLaneKeys } from './shroomScreen'
import { useShownWhen, useTimeout } from './timing'
import type { Contestant, MiniGameViewProps, TutorialArtProps } from './types'

const SHROOM_ICON = spellIconUrl('TeemoR.png')
/** The tutorial's planter and walker. */
const PLANTER = MINI_GAMES.shrooms.champion
const WALKER = MINI_GAMES.shrooms.botChampion

/** Milliseconds between hops when you watch someone walk your path. */
const HOP_MS = 750
/** Seconds the last hop (and its boom) plays before the result call. */
const SETTLE_SECONDS = 0.9
/** Seconds a walk's result stays up. */
const RESULT_SECONDS = 2.6
/** Seconds "TIE! Plant again." stays up. */
const TIE_SECONDS = 2
/** Seconds "PLANT!" or "WALK!" shows when your turn starts. Your walk timer starts after it. */
const INTRO_SECONDS = 1.1

const NO_WALK: WalkResult = { booms: [], dodged: 0 }

/**
 * Shroom Hopscotch: Teemo hides 3 shrooms on a two-lane path, the other player walks it from A to B.
 * The walker always walks all the way: each shroom stepped on is a point for the planter, each one
 * dodged a point for the walker. Played in halves: in each half one player plants and the other
 * walks (`planterOf`). Each step is its own move, so the planter watches the walk live.
 */
export function ShroomGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const results = useMemo(() => halfResults(moves, setup), [moves, setup])
  const over = useMemo(() => SHROOM_RULES.settle(moves, setup) !== null, [moves, setup])
  /**
   * Halves whose result has been shown. A player who rejoins mid-game starts at the half in play:
   * the finished ones count, but aren't replayed. (Nobody else can have a finished half yet when
   * the game opens: every half needs their own plan or walk.)
   */
  const [seen, setSeen] = useState(results.length)
  const half = over ? Math.min(seen, results.length - 1) : seen
  const current = useMemo(() => halfMoves(moves, setup, half), [moves, setup, half])
  const oneRole = setup.variant === 'live' && !setup.bothRoles
  const tieAfter = !oneRole && !over && endsTiedPair(results, half)
  const next = useCallback(() => setSeen(half + 1), [half])
  useShownWhen(over && seen >= results.length, onShown, 200)

  return (
    <HalfStage
      key={half}
      setup={setup}
      me={me}
      players={players}
      half={half}
      current={current}
      earlier={oneRole ? [] : results.slice(half - (half % 2), half)}
      tieAfter={tieAfter}
      sendMove={sendMove}
      onDone={next}
    />
  )
}

/** The second half of a pair, when both got the same points. */
function endsTiedPair(results: readonly HalfResult[], half: number): boolean {
  if (half % 2 === 0 || results.length <= half) return false
  const [first, second] = pointsOf(results.slice(half - 1, half + 1))
  return first === second
}

interface HalfStageProps {
  setup: GameSetup
  me: Player
  players: readonly [Contestant, Contestant]
  half: number
  /** What has been played of this half: the plan once sent, the walk step by step. */
  current: HalfMoves
  /** Walks already shown in this pair of halves, for the points. */
  earlier: readonly HalfResult[]
  /** This half ends a tied pair: "Tie! Plant again." before the next one. */
  tieAfter: boolean
  sendMove: (step: number, value: number) => void
  onDone: () => void
}

type AfterWalk = 'walk' | 'call' | 'tie'

/** One half: plant (or wait for the plan), walk (or watch the walk live, hop by hop), then the result. */
function HalfStage({ setup, me, players, half, current, earlier, tieAfter, sendMove, onDone }: HalfStageProps) {
  const { planter, walker, plan, steps: sentSteps } = current
  const iPlant = planter === me

  const [draft, setDraft] = useState<ShroomPlan>(emptyPlan)
  /** Your own steps show at once, before the network echoes them back. */
  const [myWalk, setMyWalk] = useState<readonly Side[]>([])
  const [introOver, setIntroOver] = useState(false)
  const [after, setAfter] = useState<AfterWalk>('walk')

  const walked = !iPlant && myWalk.length > sentSteps.length ? myWalk : sentSteps
  const steps = walked.slice(0, useHops(walked.length, !iPlant, HOP_MS))
  const walk = plan ? walkPath(plan, steps) : NO_WALK
  /** The whole walk is in the moves and on show: time for the result. */
  const halfOver = sentSteps.length >= PATH_STEPS && steps.length >= PATH_STEPS

  const planting = iPlant && plan === null
  const walking = !iPlant && plan !== null && walked.length < PATH_STEPS && introOver
  const myTurnStarted = iPlant || plan !== null
  const showIntro = !introOver && myTurnStarted && (iPlant ? planting : walked.length === 0)
  const watching = iPlant && plan !== null && !halfOver

  useTimeout(() => setIntroOver(true), INTRO_SECONDS * 1000, myTurnStarted)
  useTimeout(() => setAfter('call'), SETTLE_SECONDS * 1000, halfOver && after === 'walk')
  useTimeout(() => (tieAfter ? setAfter('tie') : onDone()), RESULT_SECONDS * 1000, after === 'call')
  useTimeout(onDone, TIE_SECONDS * 1000, after === 'tie')

  const submitPlan = (value: ShroomPlan) => sendMove(slotOf(half, me, setup), encodePlan(value))
  const plant = (step: number, side: Side) => setDraft((draftPlan) => toggleShroom(draftPlan, step, side))

  const takeStep = useCallback(
    (side: Side) => {
      if (!walking) return
      setMyWalk([...walked, side])
      sendMove(slotOf(half, me, setup) + walked.length, encodeStep(side))
    },
    [walking, walked, sendMove, half, me, setup],
  )
  useLaneKeys(takeStep, walking)

  const walkerName = players[walker].name
  const heading = planting ? `Block ${walkerName}!` : iPlant ? `${walkerName} walks your path` : 'Walk across!'
  const waitingFor = !iPlant && plan === null ? players[planter].name : iPlant && plan !== null && walked.length === 0 ? walkerName : null
  /** A walker sees only the shrooms that went off, and all of them once the walk is over. */
  const shrooms = iPlant ? (plan ?? draft) : plan && (halfOver ? plan : revealedShrooms(plan, walk.booms))
  const shown = halfOver ? [...earlier, { walker, walk }] : earlier

  return (
    <div className="flex flex-col items-center gap-3">
      <Scoreboard players={players} me={me} points={pointsOf(shown)} middle={middleLabel(setup, half)} />
      <p
        className={`text-center font-display text-lg font-black sm:text-xl ${planting || !iPlant ? 'text-hextech' : 'text-gold-light'}`}
        aria-live="polite"
      >
        {heading}
      </p>
      {(!iPlant || setup.variant === 'live') && (
        <div className="flex h-14 w-full items-center justify-center">
          {walking && (
            <ChoiceTimer
              key={`step-${walked.length}`}
              seconds={STEP_SECONDS[setup.variant]}
              onTimeout={() => takeStep(timeoutSide(setup, half, walked.length))}
            />
          )}
          {planting && <ChoiceTimer key="plant" seconds={PLANT_SECONDS} onTimeout={() => submitPlan(timeoutPlan(draft, setup, half))} />}
          {waitingFor && <Waiting name={waitingFor} />}
          {watching && steps.length > 0 && (
            <p className="font-display text-lg font-black text-gold-light/70" aria-live="polite">
              Step {steps.length} / {PATH_STEPS}
            </p>
          )}
        </div>
      )}
      <Board
        shrooms={shrooms}
        shroomsYours={iPlant}
        steps={steps}
        walker={{ champion: players[walker].champion, you: walker === me }}
        booms={walk.booms}
        arrived={after !== 'walk'}
        showRoute={iPlant && walked.length === 0}
        onPlant={planting ? plant : undefined}
        onStep={walking ? takeStep : undefined}
      >
        {plan !== null && <BoomCounter booms={walk.booms.length} total={shroomsPlaced(plan)} live={watching} />}
        {showIntro && <BigCall overlay text={iPlant ? 'PLANT!' : 'WALK!'} tone="you" size="large" />}
        {after === 'call' && plan && (
          <WalkCall walk={walk} total={shroomsPlaced(plan)} who={walker === me ? 'You' : walkerName} tone={halfTone(walk, iPlant)} />
        )}
        {after === 'tie' && <BigCall overlay text="TIE!" tone="plain" sub="Plant again." />}
      </Board>
      {planting && (
        <div className="flex items-center gap-3">
          <ShroomTray left={SHROOM_COUNT - shroomsPlaced(draft)} />
          <Button onClick={() => submitPlan(draft)} disabled={!isPlanReady(draft)}>
            Plant
          </Button>
        </div>
      )}
      {walking && <p className="text-xs text-gold-light/50">Tap a glowing spot · ↑ ↓ · A boom won’t stop you</p>}
    </div>
  )
}

/** Gold when the walk went your way (more of your points than theirs), red when it didn't. */
function halfTone(walk: WalkResult, iPlant: boolean): Tone {
  const { planter, walker } = walkPoints(walk)
  const [mine, theirs] = iPlant ? [planter, walker] : [walker, planter]
  return mine === theirs ? 'plain' : mine > theirs ? 'win' : 'lose'
}

function middleLabel(setup: GameSetup, half: number): string {
  if (setup.variant === 'solo') return half >= 2 ? `Tie-break ${Math.floor(half / 2)}` : 'vs'
  return setup.bothRoles ? `${half + 1} / 2` : 'vs'
}

interface ScoreboardProps {
  players: readonly [Contestant, Contestant]
  me: Player
  points: readonly [number, number]
  middle: string
}

function Scoreboard({ players, me, points, middle }: ScoreboardProps) {
  const them = other(me)
  return (
    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
      <ContestantTag contestant={players[me]} you value={`${points[me]}`} />
      <span className="text-center text-xs font-semibold tracking-wider text-gold-light/60 uppercase">{middle}</span>
      <ContestantTag contestant={players[them]} you={false} value={`${points[them]}`} />
    </div>
  )
}

interface WalkCallProps {
  walk: WalkResult
  /** Shrooms on the path. */
  total: number
  /** "You" or the opponent's name. */
  who: string
  tone: Tone
}

/** SAFE!, BOOM! or 3× BOOM!, gold when it went your way and red when it didn't. */
function WalkCall({ walk, total, who, tone }: WalkCallProps) {
  const booms = walk.booms.length
  const text = booms === 0 ? 'SAFE!' : booms === 1 ? 'BOOM!' : `${booms}× BOOM!`
  const sub = booms === 0 ? `${who} dodged every shroom!` : `${who} hit ${booms} of ${total} shrooms`
  return <BigCall overlay text={text} tone={tone} sub={sub} />
}

/** Booms so far, in the corner of the path. "LIVE" while you watch someone walk your shrooms. */
function BoomCounter({ booms, total, live }: { booms: number; total: number; live: boolean }) {
  return (
    <>
      {live && (
        <span className="absolute top-1.5 left-1.5 z-20 flex items-center gap-1 rounded-full bg-abyss/80 px-2 py-0.5 text-[10px] font-black tracking-widest text-red-400 sm:text-xs">
          <motion.span
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.1, repeat: Infinity }}
            className="size-1.5 rounded-full bg-red-500 sm:size-2"
            aria-hidden="true"
          />
          LIVE
        </span>
      )}
      <motion.span
        key={booms}
        initial={{ scale: booms > 0 ? 1.6 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 14 }}
        className={`absolute top-1.5 right-1.5 z-20 flex items-center gap-1 rounded-full px-2 py-0.5 font-display text-xs font-black sm:text-sm ${
          booms > 0 ? 'bg-lime-950/85 text-lime-300' : 'bg-abyss/80 text-gold-light/70'
        }`}
        aria-label={`${booms} of ${total} shrooms hit`}
      >
        <img src={SHROOM_ICON} alt="" className="size-4 rounded-full sm:size-5" />
        {booms} / {total}
      </motion.span>
    </>
  )
}

function ShroomTray({ left }: { left: number }) {
  return (
    <div className="flex gap-1.5" role="img" aria-label={`${left} shrooms left`}>
      {Array.from({ length: SHROOM_COUNT }, (_, index) => (
        <img
          key={index}
          src={SHROOM_ICON}
          alt=""
          className={`size-9 rounded-full border-2 transition ${index < left ? 'border-gold' : 'border-gold/20 opacity-25 grayscale'}`}
        />
      ))}
    </div>
  )
}

// ── The path ─────────────────────────────────────────────────────

/** Columns on the board: the start (A), the steps, the finish (B). */
const COLUMNS = PATH_STEPS + 2
const COLUMN_WIDTH = 50
const VIEW_WIDTH = COLUMNS * COLUMN_WIDTH
const VIEW_HEIGHT = 160
const MID_Y = 80
/** Where things sit on the board, in percent. */
const columnX = (column: number) => ((column + 0.5) / COLUMNS) * 100
const ROW_Y: Record<Side, number> = { up: 31.25, down: 68.75 }
const TOKEN_WIDTH = `${(100 / COLUMNS) * 0.8}%`

interface BoardProps {
  /** Shrooms on show: your plan, or theirs as they go off (all of them once your walk is over). */
  shrooms: ShroomPlan | null
  shroomsYours: boolean
  /** Lanes walked so far. */
  steps: readonly Side[]
  walker: { champion: string; you: boolean }
  /** Steps that went boom so far. */
  booms: readonly number[]
  /** The walk is over: the walker hops onto B. */
  arrived: boolean
  /** While planting: the walker's dashed route from A to B. */
  showRoute: boolean
  onPlant?: (step: number, side: Side) => void
  /** While walking: the two spots of the next step glow. */
  onStep?: (side: Side) => void
  /** Calls drawn over the board. */
  children?: ReactNode
}

/** The lane from A (left) to B (right): two rows of stepping stones, one column per step. */
function Board({ shrooms, shroomsYours, steps, walker, booms, arrived, showRoute, onPlant, onStep, children }: BoardProps) {
  const planting = onPlant !== undefined
  const plantedAll = shrooms !== null && shroomsPlaced(shrooms) >= SHROOM_COUNT
  const [scope, animate] = useAnimate<HTMLDivElement>()

  // Every boom shakes the path.
  useEffect(() => {
    if (booms.length > 0 && scope.current) void animate(scope.current, { x: [0, -9, 9, -6, 6, -3, 0] }, { duration: 0.45 })
  }, [booms.length, animate, scope])

  return (
    <div ref={scope} className="relative aspect-[35/16] w-full max-w-xl overflow-hidden rounded-lg border-2 border-gold/40 select-none">
      <LaneArt arrows={!showRoute} />
      {showRoute && <RouteArrow toX={(COLUMNS - 0.5) * COLUMN_WIDTH - 18} />}
      <span
        className="absolute bottom-[14%] -translate-x-1/2 font-display text-sm font-black text-gold-light drop-shadow-[0_1px_2px_black] sm:text-lg"
        style={{ left: `${columnX(0)}%` }}
      >
        A
      </span>
      <FinishMark />
      <div
        className="absolute inset-x-0 top-[12.5%] bottom-[12.5%] grid grid-rows-2"
        style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: PATH_STEPS }, (_, step) =>
          SIDES.map((side) => {
            const hasShroom = shrooms?.[step] === side
            const passed = steps[step] !== undefined
            return (
              <Spot
                key={`${step}-${side}`}
                step={step}
                side={side}
                look={spotLook(step, side, { shrooms, steps, planting, plantedAll, choiceStep: onStep ? steps.length : null })}
                walkerYou={walker.you}
                shroom={hasShroom ? (shroomsYours ? 'yours' : 'theirs') : null}
                spent={hasShroom && passed && !booms.includes(step)}
                revealDelay={shroomsYours || booms.includes(step) ? 0 : 0.35}
                onTap={onPlant ? () => onPlant(step, side) : onStep && step === steps.length ? () => onStep(side) : undefined}
              />
            )
          }),
        )}
      </div>
      <WalkerToken {...walker} steps={steps} hit={booms.at(-1) === steps.length - 1} arrived={arrived} />
      {booms.map((step) => {
        const side = steps[step]
        return side && <Explosion key={step} x={columnX(step + 1)} y={ROW_Y[side]} />
      })}
      {children}
    </div>
  )
}

type SpotLook = 'idle' | 'open' | 'planted' | 'blocked' | 'choice' | 'stepped' | 'skipped'

interface SpotState {
  shrooms: ShroomPlan | null
  steps: readonly Side[]
  planting: boolean
  plantedAll: boolean
  choiceStep: number | null
}

function spotLook(step: number, side: Side, { shrooms, steps, planting, plantedAll, choiceStep }: SpotState): SpotLook {
  if (planting) {
    const planted = shrooms?.[step]
    if (planted === side) return 'planted'
    if (planted) return 'blocked'
    return plantedAll ? 'idle' : 'open'
  }
  if (step === choiceStep) return 'choice'
  const stepped = steps[step]
  if (stepped === side) return 'stepped'
  return stepped ? 'skipped' : 'idle'
}

const SPOT_LOOKS: Record<Exclude<SpotLook, 'stepped'>, string> = {
  idle: 'border-amber-100/30 bg-stone-950/25',
  open: 'border-gold/80 bg-gold/15 group-hover:bg-gold/30',
  planted: 'border-hextech bg-hextech/20',
  blocked: 'border-dashed border-amber-100/30 bg-stone-950/50 opacity-45',
  choice: 'border-gold-light bg-gold/35 shadow-[0_0_16px_rgb(240_230_210/0.75)] group-hover:bg-gold/60',
  skipped: 'border-amber-100/20 bg-stone-950/30 opacity-40',
}

const lookClass = (look: SpotLook, walkerYou: boolean) =>
  look === 'stepped' ? (walkerYou ? 'border-hextech bg-hextech/35' : 'border-red-400 bg-red-400/30') : SPOT_LOOKS[look]

interface SpotProps {
  step: number
  side: Side
  look: SpotLook
  walkerYou: boolean
  shroom: 'yours' | 'theirs' | null
  /** A shroom the walker went past on the other lane: dodged, so it fades. */
  spent: boolean
  /** Seconds before a revealed shroom pops up. */
  revealDelay: number
  onTap?: () => void
}

function Spot({ step, side, look, walkerYou, shroom, spent, revealDelay, onTap }: SpotProps) {
  const lane = side === 'up' ? 'top' : 'bottom'
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={!onTap}
      aria-label={`Step ${step + 1}, ${lane}${shroom ? ', shroom' : ''}`}
      className="group flex touch-manipulation items-center justify-center rounded-full outline-gold focus-visible:outline-2 disabled:cursor-default"
      style={{ gridColumn: step + 2, gridRow: side === 'up' ? 1 : 2 }}
    >
      <span className={`relative flex aspect-square w-[80%] items-center justify-center rounded-full border-2 transition ${lookClass(look, walkerYou)}`}>
        {look === 'choice' && (
          <motion.span
            animate={{ scale: [1, 1.35], opacity: [0.9, 0] }}
            transition={{ duration: 0.9, repeat: Infinity }}
            className="absolute inset-0 rounded-full border-2 border-gold-light"
            aria-hidden="true"
          />
        )}
        {look === 'blocked' && (
          <span className="text-base font-black text-red-300/90 sm:text-2xl" aria-hidden="true">
            ✕
          </span>
        )}
        {shroom && (
          <motion.img
            src={SHROOM_ICON}
            alt=""
            initial={{ scale: 0, rotate: -40 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 16, delay: revealDelay }}
            className={`absolute size-[88%] rounded-full border-2 transition-[filter,opacity] duration-500 ${
              shroom === 'yours' ? 'border-hextech' : 'border-red-400'
            } ${spent ? 'opacity-35 grayscale' : ''}`}
          />
        )}
      </span>
    </button>
  )
}

interface WalkerTokenProps {
  champion: string
  you: boolean
  steps: readonly Side[]
  /** The last step went boom: the walker staggers, then walks on. */
  hit: boolean
  /** The walk is over: the walker hops onto B. */
  arrived: boolean
}

/** The walker's champion, hopping from stone to stone. A boom knocks them about but never stops them. */
function WalkerToken({ champion, you, steps, hit, arrived }: WalkerTokenProps) {
  const last = steps.at(-1)
  const left = arrived ? columnX(COLUMNS - 1) : last ? columnX(steps.length) : columnX(0)
  const top = arrived || !last ? 50 : ROW_Y[last]
  return (
    <motion.div
      initial={false}
      animate={{ left: `${left}%`, top: `${top}%` }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="pointer-events-none absolute z-10 aspect-square -translate-x-1/2 -translate-y-1/2"
      style={{ width: TOKEN_WIDTH }}
    >
      <motion.div
        key={steps.length}
        animate={hit && !arrived ? { rotate: [0, -35, 20, -10, 0], scale: [1, 1.3, 0.9, 1] } : { rotate: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="size-full"
      >
        <motion.img
          key={steps.length + (arrived ? 1 : 0)}
          src={championIconById(champion)}
          alt=""
          animate={{ y: [0, -14, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 0.35 }}
          className={`size-full rounded-full border-2 shadow-lg shadow-black/60 ${you ? 'border-hextech' : 'border-red-400'}`}
        />
      </motion.div>
    </motion.div>
  )
}

const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

/** A shroom going off: a flash, a shock ring, sparks and a lingering toxic cloud. */
function Explosion({ x, y }: { x: number; y: number }) {
  return (
    <div
      className="pointer-events-none absolute z-[15] flex aspect-square -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      style={{ left: `${x}%`, top: `${y}%`, width: TOKEN_WIDTH }}
      aria-hidden="true"
    >
      <motion.span
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 2.6, 2.3], opacity: [0, 0.75, 0.45] }}
        transition={{ duration: 1.4 }}
        className="absolute size-full rounded-full bg-lime-400/60 blur-md"
      />
      <motion.span
        initial={{ scale: 0.2, opacity: 1 }}
        animate={{ scale: 2.4, opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="absolute size-full rounded-full bg-orange-400"
      />
      <motion.span
        initial={{ scale: 0.4, opacity: 1 }}
        animate={{ scale: 3, opacity: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="absolute size-full rounded-full border-4 border-yellow-200"
      />
      {SPARK_ANGLES.map((angle) => (
        <motion.span
          key={angle}
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: [0, 1.8], opacity: [1, 0] }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="absolute top-1/2 left-1/2 h-1 w-1/2 origin-left rounded-full bg-yellow-300"
          style={{ rotate: angle }}
        />
      ))}
    </div>
  )
}

/** B: a flag at the finish. */
function FinishMark() {
  return (
    <div
      className="absolute top-[12.5%] bottom-[12.5%] flex -translate-x-1/2 flex-col items-center justify-center"
      style={{ left: `${columnX(COLUMNS - 1)}%`, width: TOKEN_WIDTH }}
      aria-hidden="true"
    >
      <Flag className="h-[45%]" />
      <span className="absolute bottom-[3%] font-display text-sm font-black text-gold-light drop-shadow-[0_1px_2px_black] sm:text-lg">B</span>
    </div>
  )
}

function Flag({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 32" className={className} aria-hidden="true">
      <rect x="3" y="2" width="2.5" height="28" rx="1" fill="#f0e6d2" />
      <path d="M5.5 3 L21 8.5 L5.5 14 Z" fill="#c8aa6e" stroke="#785a28" strokeWidth="1" />
    </svg>
  )
}

const LANE_PATH =
  'M0 22 C45 14 90 28 135 20 S225 14 270 22 S330 24 350 18 L350 142 C305 148 260 134 215 141 S125 147 80 138 S20 136 0 142 Z'
const PEBBLES: readonly [number, number, number][] = [
  [18, 30, 2.2],
  [70, 130, 1.8],
  [140, 27, 2],
  [205, 134, 2.4],
  [262, 30, 1.6],
  [318, 128, 2.1],
  [110, 84, 1.5],
  [240, 76, 1.4],
]

/** Top lane, drawn: grass on both sides, a dirt lane, and arrows pointing to the finish. */
function LaneArt({ arrows }: { arrows: boolean }) {
  const id = useId()
  return (
    <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-grass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#123520" />
          <stop offset="0.5" stopColor="#2c6136" />
          <stop offset="1" stopColor="#123520" />
        </linearGradient>
        <linearGradient id={`${id}-dirt`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a4027" />
          <stop offset="0.5" stopColor="#8d6b43" />
          <stop offset="1" stopColor="#5a4027" />
        </linearGradient>
      </defs>
      <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill={`url(#${id}-grass)`} />
      <path d={LANE_PATH} fill={`url(#${id}-dirt)`} stroke="#3f7a3a" strokeWidth="3" />
      <line x1="0" y1={MID_Y} x2={VIEW_WIDTH} y2={MID_Y} stroke="#b08f62" strokeOpacity="0.25" strokeWidth="34" />
      {PEBBLES.map(([x, y, radius]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={radius} ry={radius * 0.7} fill="#3b2a18" opacity="0.4" />
      ))}
      {arrows &&
        Array.from({ length: COLUMNS - 1 }, (_, index) => {
          const x = (index + 1) * COLUMN_WIDTH
          return (
            <path
              key={x}
              d={`M${x - 4} ${MID_Y - 7} L${x + 3} ${MID_Y} L${x - 4} ${MID_Y + 7}`}
              fill="none"
              stroke="#f0e6d2"
              strokeOpacity="0.55"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        })}
    </svg>
  )
}

/** "Ezreal wants to go from A to B": a dashed, moving arrow along the lane. */
function RouteArrow({ toX }: { toX: number }) {
  const fromX = COLUMN_WIDTH / 2 + 16
  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 size-full"
      aria-hidden="true"
    >
      <motion.line
        x1={fromX}
        y1={MID_Y}
        x2={toX - 8}
        y2={MID_Y}
        stroke="#f0e6d2"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="7 6"
        animate={{ strokeDashoffset: [0, -26] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
      />
      <path d={`M${toX - 11} ${MID_Y - 7} L${toX} ${MID_Y} L${toX - 11} ${MID_Y + 7} Z`} fill="#f0e6d2" />
    </svg>
  )
}

// ── Tutorial pictures ────────────────────────────────────────────

const MINI_LANE = 'bg-[linear-gradient(to_bottom,#2c6136_0_16%,#8d6b43_16%_84%,#2c6136_84%)]'

/** 1: Teemo plants 3 shrooms, one per column. 2: Ezreal walks through, a boom, and on he goes. 3: the points. */
export function ShroomTutorialArt({ step }: TutorialArtProps) {
  if (step === 0) return <PlantArt />
  if (step === 1) return <WalkThroughArt />
  return <PointsArt />
}

const ART_SHROOMS: readonly { column: number; side: Side }[] = [
  { column: 0, side: 'up' },
  { column: 1, side: 'down' },
  { column: 2, side: 'up' },
]

function PlantArt() {
  return (
    <div className={`relative size-full ${MINI_LANE}`}>
      <div className="absolute inset-x-[6%] inset-y-[18%] grid grid-cols-3 grid-rows-2 place-items-center">
        {[0, 1, 2].map((column) =>
          SIDES.map((side) => {
            const index = ART_SHROOMS.findIndex((shroom) => shroom.column === column && shroom.side === side)
            return (
              <span
                key={`${column}-${side}`}
                className="relative flex aspect-square w-[70%] items-center justify-center rounded-full border-2 border-amber-100/40 bg-stone-950/30"
                style={{ gridColumn: column + 1, gridRow: side === 'up' ? 1 : 2 }}
              >
                {index >= 0 && (
                  <motion.img
                    src={SHROOM_ICON}
                    alt=""
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.25, 1, 1, 0] }}
                    transition={{ duration: 3, times: [0, 0.08, 0.14, 0.92, 1], delay: index * 0.45, repeat: Infinity }}
                    className="absolute size-full rounded-full border-2 border-hextech"
                  />
                )}
              </span>
            )
          }),
        )}
      </div>
      <img
        src={championIconById(PLANTER)}
        alt=""
        className="absolute right-0.5 bottom-0.5 size-[30%] rounded-full border-2 border-hextech shadow-md shadow-black/60"
      />
    </div>
  )
}

/** The walk loops every few seconds: hop, hop onto a shroom (boom), hop, finish. */
const WALK_LOOP = 3.6
const WALK_TIMES = [0, 0.22, 0.44, 0.66, 0.88, 1]

function WalkThroughArt() {
  return (
    <div className={`relative size-full overflow-hidden ${MINI_LANE}`}>
      <div className="absolute inset-y-[16%] right-[16%] left-[18%] grid grid-cols-3 grid-rows-2 place-items-center">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} className="relative aspect-square w-[62%] rounded-full border-2 border-amber-100/40 bg-stone-950/30">
            {index === 4 && <img src={SHROOM_ICON} alt="" className="absolute inset-0 size-full rounded-full border-2 border-red-400" />}
          </span>
        ))}
      </div>
      <motion.span
        animate={{ scale: [0, 0, 2.2, 0, 0], opacity: [0, 0, 0.9, 0, 0] }}
        transition={{ duration: WALK_LOOP, times: [0, 0.43, 0.5, 0.62, 1], repeat: Infinity }}
        className="absolute top-[67%] left-[51%] size-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-400/80 blur-[2px]"
        aria-hidden="true"
      />
      <Flag className="absolute top-1/2 right-[2%] h-[30%] -translate-y-1/2" />
      <motion.img
        src={championIconById(WALKER)}
        alt=""
        animate={{
          left: ['8%', '29%', '51%', '73%', '90%', '90%'],
          top: ['50%', '33%', '67%', '33%', '50%', '50%'],
          rotate: [0, 0, -30, 0, 0, 0],
        }}
        transition={{ duration: WALK_LOOP, times: WALK_TIMES, ease: 'easeInOut', repeat: Infinity }}
        className="absolute size-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-400 shadow-md shadow-black/60"
      />
    </div>
  )
}

function PointsArt() {
  return (
    <div className="grid size-full grid-cols-[1fr_auto_1fr] grid-rows-2 place-items-center gap-x-1 bg-abyss/60 px-[8%] py-[10%]">
      <span className="relative flex aspect-square w-[80%] items-center justify-center">
        <motion.span
          animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0, 0.8] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="absolute inset-0 rounded-full bg-lime-400/60 blur-[2px]"
          aria-hidden="true"
        />
        <img src={SHROOM_ICON} alt="" className="relative size-full rounded-full border-2 border-red-400" />
      </span>
      <span className="font-display text-sm font-black text-gold sm:text-lg">+1</span>
      <img src={championIconById(PLANTER)} alt="" className="aspect-square w-[80%] rounded-full border-2 border-hextech" />
      <span className="relative flex aspect-square w-[80%] items-center justify-center">
        <img src={SHROOM_ICON} alt="" className="size-full rounded-full border-2 border-gold/30 opacity-35 grayscale" />
        <span className="absolute font-black text-gold-light sm:text-xl">✓</span>
      </span>
      <span className="font-display text-sm font-black text-gold sm:text-lg">+1</span>
      <img src={championIconById(WALKER)} alt="" className="aspect-square w-[80%] rounded-full border-2 border-red-400" />
    </div>
  )
}
