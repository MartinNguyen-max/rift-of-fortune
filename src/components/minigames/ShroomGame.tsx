import { motion } from 'framer-motion'
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { spellIconUrl } from '../../data'
import {
  decodePlan,
  decodeWalk,
  emptyPlan,
  encodePlan,
  encodeWalk,
  halfResults,
  isPlanReady,
  PATH_STEPS,
  PLANT_SECONDS,
  planterOf,
  SHROOM_COUNT,
  SHROOM_RULES,
  shroomsPlaced,
  SIDES,
  STEP_SECONDS,
  toggleShroom,
  walkPath,
  WALKER_GOAL,
  type ShroomPlan,
  type Side,
  type WalkResult,
} from '../../game/minigames/shrooms'
import { other, type GameSetup, type Player } from '../../game/minigames/versus'
import { Button } from '../Button'
import { championIconById } from './miniGameArt'
import { BigCall, ChoiceTimer, ContestantTag, Waiting } from './parts'
import { timeoutPlan, timeoutSide, useLaneKeys, walkToShow } from './shroomScreen'
import { useShownWhen, useTimeout } from './timing'
import type { Contestant, MiniGameViewProps, TutorialArtProps } from './types'

const SHROOM_ICON = spellIconUrl('TeemoR.png')

/** Seconds between hops when you watch someone walk your path. */
const HOP_SECONDS = 0.75
/** Seconds the explosion (or the last hop) plays before the result call. */
const SETTLE_SECONDS = 0.8
/** Seconds a walk's result stays up. */
const RESULT_SECONDS = 2.4
/** Seconds "TIE! Plant again." stays up. */
const TIE_SECONDS = 2
/** Seconds "PLANT!" or "WALK!" shows when your turn starts. Your walk timer starts after it. */
const INTRO_SECONDS = 1.1

const NO_WALK: WalkResult = { safeSteps: 0, boomAt: null }

interface HalfResult {
  walker: Player
  walk: WalkResult
}

/**
 * Shroom Hopscotch: Teemo hides 3 shrooms on a two-lane path, the other player walks it from A to B.
 * Played in halves: in each half one player plants and the other walks (`planterOf`).
 */
export function ShroomGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const results = useMemo(() => halfResults(moves, setup), [moves, setup])
  const over = useMemo(() => SHROOM_RULES.settle(moves, setup) !== null, [moves, setup])
  /** Halves whose result has been shown. */
  const [seen, setSeen] = useState(0)
  const half = over ? Math.min(seen, results.length - 1) : seen
  const planter = planterOf(half, setup)
  const walker = other(planter)
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
      planMove={moves[planter][half]}
      walkMove={moves[walker][half]}
      earlier={results.slice(half - (half % 2), half)}
      tieAfter={tieAfter}
      sendMove={sendMove}
      onDone={next}
    />
  )
}

/** The second half of a pair, when both walked equally far. */
function endsTiedPair(results: readonly HalfResult[], half: number): boolean {
  if (half % 2 === 0) return false
  const first = results[half - 1]
  const second = results[half]
  return first !== undefined && second !== undefined && first.walk.safeSteps === second.walk.safeSteps
}

interface HalfStageProps {
  setup: GameSetup
  me: Player
  players: readonly [Contestant, Contestant]
  half: number
  /** The planter's move this half (their plan), once sent. */
  planMove: number | undefined
  /** The walker's move this half (their whole walk), once it is over. */
  walkMove: number | undefined
  /** Walks already shown in this pair of halves, for the scores. */
  earlier: readonly HalfResult[]
  /** This half ends a tied pair: "Tie! Plant again." before the next one. */
  tieAfter: boolean
  sendMove: (step: number, value: number) => void
  onDone: () => void
}

type AfterWalk = 'walk' | 'call' | 'tie'

/** One half: plant (or wait for the plan), walk (or watch the walk hop by hop), then the result. */
function HalfStage({ setup, me, players, half, planMove, walkMove, earlier, tieAfter, sendMove, onDone }: HalfStageProps) {
  const them = other(me)
  const planter = planterOf(half, setup)
  const walker = other(planter)
  const iPlant = planter === me
  /** Live one-role games: the walker wins at the flag. Otherwise the walk goes to the finish. */
  const goal = setup.variant === 'live' && !setup.bothRoles ? WALKER_GOAL : null
  const stepsToGo = goal ?? PATH_STEPS

  const [draft, setDraft] = useState<ShroomPlan>(emptyPlan)
  const [myWalk, setMyWalk] = useState<Side[]>([])
  /** Steps of the sent walk on show: a walk you watch plays one hop at a time. */
  const [shown, setShown] = useState(0)
  const [introOver, setIntroOver] = useState(false)
  const [after, setAfter] = useState<AfterWalk>('walk')

  const plan = useMemo(() => (planMove === undefined ? null : decodePlan(planMove)), [planMove])
  const sentWalk = useMemo(
    () => (walkMove === undefined || !plan ? null : walkToShow(plan, decodeWalk(walkMove), stepsToGo)),
    [walkMove, plan, stepsToGo],
  )
  const steps = sentWalk ? sentWalk.slice(0, shown) : myWalk
  const walk = plan ? walkPath(plan, steps) : NO_WALK
  const finished = sentWalk ? shown >= sentWalk.length : walk.boomAt !== null || walk.safeSteps >= stepsToGo
  /** The walk is in the moves and fully shown: time for the result. */
  const halfOver = sentWalk !== null && finished
  const success = walk.boomAt === null ? walk.safeSteps >= stepsToGo : goal !== null && walk.safeSteps >= goal

  const planting = iPlant && planMove === undefined
  const walking = !iPlant && plan !== null && !sentWalk && !finished && introOver
  const myTurnStarted = iPlant || plan !== null
  const showIntro = !introOver && (iPlant ? planting : !sentWalk) && myTurnStarted

  useTimeout(() => setIntroOver(true), INTRO_SECONDS * 1000, myTurnStarted)
  usePlayback(sentWalk, shown, setShown)
  useTimeout(() => setAfter('call'), SETTLE_SECONDS * 1000, halfOver && after === 'walk')
  useTimeout(() => (tieAfter ? setAfter('tie') : onDone()), RESULT_SECONDS * 1000, after === 'call')
  useTimeout(onDone, TIE_SECONDS * 1000, after === 'tie')

  const submitPlan = (value: ShroomPlan) => sendMove(half, encodePlan(value))
  const plant = (step: number, side: Side) => setDraft((current) => toggleShroom(current, step, side))

  const takeStep = useCallback(
    (side: Side) => {
      if (!walking || !plan) return
      const next = [...myWalk, side]
      setMyWalk(next)
      setShown(next.length)
      const result = walkPath(plan, next)
      if (result.boomAt !== null || result.safeSteps >= stepsToGo) sendMove(half, encodeWalk(next))
    },
    [walking, plan, myWalk, stepsToGo, sendMove, half],
  )
  useLaneKeys(takeStep, walking)

  const walkerName = players[walker].name
  const heading = iPlant ? (sentWalk ? `${walkerName} walks your path` : `Block ${walkerName}!`) : goal ? 'Reach the flag!' : 'Walk across!'
  const waitingFor = !iPlant && plan === null ? players[planter].name : iPlant && planMove !== undefined && !sentWalk ? walkerName : null

  return (
    <div className="flex flex-col items-center gap-3">
      <Scoreboard
        players={players}
        me={me}
        values={scoreValues([...earlier, { walker, walk }], goal)}
        middle={middleLabel(setup, half)}
      />
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
              key={`step-${steps.length}`}
              seconds={STEP_SECONDS[setup.variant]}
              onTimeout={() => takeStep(timeoutSide(setup, half, steps.length))}
            />
          )}
          {planting && <ChoiceTimer key="plant" seconds={PLANT_SECONDS} onTimeout={() => submitPlan(timeoutPlan(draft, setup, half))} />}
          {waitingFor && <Waiting name={waitingFor} />}
        </div>
      )}
      <Board
        shrooms={iPlant ? (plan ?? draft) : finished ? plan : null}
        shroomsYours={iPlant}
        steps={steps}
        walker={{ champion: players[walker].champion, you: walker === me }}
        boomAt={walk.boomAt}
        arrived={after !== 'walk' && success && walk.boomAt === null}
        goal={goal}
        showRoute={iPlant && !sentWalk}
        onPlant={planting ? plant : undefined}
        onStep={walking ? takeStep : undefined}
      >
        {showIntro && <BigCall overlay text={iPlant ? 'PLANT!' : 'WALK!'} tone="you" size="large" />}
        {after === 'call' && (
          <WalkCall walk={walk} success={success} goal={goal} who={walker === me ? 'You' : players[them].name} yours={walker === me} />
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
      {walking && <p className="text-xs text-gold-light/50">Tap a glowing spot · ↑ ↓</p>}
    </div>
  )
}

/** Plays a walk that arrived in one piece, one hop at a time. */
function usePlayback(walk: readonly Side[] | null, shown: number, setShown: (shown: number) => void) {
  useEffect(() => {
    if (!walk || shown >= walk.length) return
    const id = window.setTimeout(() => setShown(shown + 1), HOP_SECONDS * 1000)
    return () => window.clearTimeout(id)
  }, [walk, shown, setShown])
}

/** Steps walked so far, by player: both walkers in a pair, only the walker in a one-role game. */
function scoreValues(walks: readonly HalfResult[], goal: number | null): [string | undefined, string | undefined] {
  const values: [string | undefined, string | undefined] = goal === null ? ['–', '–'] : [undefined, undefined]
  for (const { walker, walk } of walks) values[walker] = `${walk.safeSteps}/${goal ?? PATH_STEPS}`
  return values
}

function middleLabel(setup: GameSetup, half: number): string {
  if (setup.variant === 'solo') return half >= 2 ? `Tie-break ${Math.floor(half / 2)}` : 'vs'
  return setup.bothRoles ? `${half + 1} / 2` : 'vs'
}

interface ScoreboardProps {
  players: readonly [Contestant, Contestant]
  me: Player
  values: readonly [string | undefined, string | undefined]
  middle: string
}

function Scoreboard({ players, me, values, middle }: ScoreboardProps) {
  const them = other(me)
  return (
    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
      <ContestantTag contestant={players[me]} you value={values[me]} />
      <span className="text-center text-xs font-semibold tracking-wider text-gold-light/60 uppercase">{middle}</span>
      <ContestantTag contestant={players[them]} you={false} value={values[them]} />
    </div>
  )
}

interface WalkCallProps {
  walk: WalkResult
  success: boolean
  goal: number | null
  /** "You" or the opponent's name. */
  who: string
  /** You walked: a boom is bad news, getting across good. */
  yours: boolean
}

/** BOOM! or SAFE!, gold when it's good for you and red when it isn't. */
function WalkCall({ walk, success, goal, who, yours }: WalkCallProps) {
  const sub = success
    ? goal === null
      ? `${who} made it across!`
      : `${who} reached the flag!`
    : `${who} walked ${walk.safeSteps} ${walk.safeSteps === 1 ? 'step' : 'steps'}`
  return <BigCall overlay text={success ? 'SAFE!' : 'BOOM!'} tone={yours === success ? 'win' : 'lose'} sub={sub} />
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
const LANE_TOP = 20
const LANE_BOTTOM = 140
const MID_Y = (LANE_TOP + LANE_BOTTOM) / 2
/** Where things sit on the board, in percent. */
const columnX = (column: number) => ((column + 0.5) / COLUMNS) * 100
const ROW_Y: Record<Side, number> = { up: 31.25, down: 68.75 }
/** The line after `goal` steps, in percent. */
const goalX = (goal: number) => ((goal + 1) / COLUMNS) * 100
const TOKEN_WIDTH = `${(100 / COLUMNS) * 0.8}%`

interface BoardProps {
  /** Shrooms on show: your plan, or theirs once your walk is over. */
  shrooms: ShroomPlan | null
  shroomsYours: boolean
  /** Lanes walked so far. */
  steps: readonly Side[]
  walker: { champion: string; you: boolean }
  boomAt: number | null
  /** The walker made it: they hop onto the finish. */
  arrived: boolean
  /** Live one-role games: the flag after this many steps. Otherwise the finish is B on the right. */
  goal: number | null
  /** While planting: Yi's dashed route from A to B. */
  showRoute: boolean
  onPlant?: (step: number, side: Side) => void
  /** While walking: the two spots of the next step glow. */
  onStep?: (side: Side) => void
  /** Calls drawn over the board. */
  children?: ReactNode
}

/** The lane from A (left) to B (right): two rows of stepping stones, one column per step. */
function Board({ shrooms, shroomsYours, steps, walker, boomAt, arrived, goal, showRoute, onPlant, onStep, children }: BoardProps) {
  const planting = onPlant !== undefined
  const plantedAll = shrooms !== null && shroomsPlaced(shrooms) >= SHROOM_COUNT
  const finishX = goal !== null && steps.length <= goal ? goalX(goal) : columnX(COLUMNS - 1)
  const boomSide = boomAt === null ? undefined : steps[boomAt]

  return (
    <motion.div
      animate={boomAt !== null ? { x: [0, -9, 9, -6, 6, -3, 0] } : { x: 0 }}
      transition={{ duration: 0.45 }}
      className="relative aspect-[35/16] w-full max-w-xl overflow-hidden rounded-lg border-2 border-gold/40 select-none"
    >
      <LaneArt arrows={!showRoute} goal={goal} />
      {showRoute && <RouteArrow toX={goal === null ? (COLUMNS - 0.5) * COLUMN_WIDTH - 18 : (goal + 1) * COLUMN_WIDTH - 4} />}
      <span
        className="absolute bottom-[14%] -translate-x-1/2 font-display text-sm font-black text-gold-light drop-shadow-[0_1px_2px_black] sm:text-lg"
        style={{ left: `${columnX(0)}%` }}
      >
        A
      </span>
      <FinishMark goal={goal} />
      <div
        className="absolute inset-x-0 top-[12.5%] bottom-[12.5%] grid grid-rows-2"
        style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: PATH_STEPS }, (_, step) =>
          SIDES.map((side) => (
            <Spot
              key={`${step}-${side}`}
              step={step}
              side={side}
              look={spotLook(step, side, { shrooms, steps, planting, plantedAll, choiceStep: onStep ? steps.length : null })}
              walkerYou={walker.you}
              shroom={shrooms?.[step] === side ? (shroomsYours ? 'yours' : 'theirs') : null}
              revealDelay={shroomsYours || step === boomAt ? 0 : 0.35}
              beyondGoal={goal !== null && step >= goal}
              onTap={onPlant ? () => onPlant(step, side) : onStep && step === steps.length ? () => onStep(side) : undefined}
            />
          )),
        )}
      </div>
      <WalkerToken {...walker} steps={steps} boom={boomAt !== null} arrived={arrived} finishX={finishX} />
      {boomAt !== null && boomSide && <Explosion x={columnX(boomAt + 1)} y={ROW_Y[boomSide]} />}
      {children}
    </motion.div>
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
  /** Seconds before a revealed shroom pops up. */
  revealDelay: number
  beyondGoal: boolean
  onTap?: () => void
}

function Spot({ step, side, look, walkerYou, shroom, revealDelay, beyondGoal, onTap }: SpotProps) {
  const lane = side === 'up' ? 'top' : 'bottom'
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={!onTap}
      aria-label={`Step ${step + 1}, ${lane}${shroom ? ', shroom' : ''}`}
      className={`group flex touch-manipulation items-center justify-center rounded-full outline-gold focus-visible:outline-2 disabled:cursor-default ${
        beyondGoal ? 'opacity-50' : ''
      }`}
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
            className={`absolute size-[88%] rounded-full border-2 ${shroom === 'yours' ? 'border-hextech' : 'border-red-400'}`}
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
  boom: boolean
  arrived: boolean
  /** Where the walker ends up when they make it, in percent. */
  finishX: number
}

/** The walker's champion, hopping from stone to stone. */
function WalkerToken({ champion, you, steps, boom, arrived, finishX }: WalkerTokenProps) {
  const last = steps.at(-1)
  const left = arrived ? finishX : last ? columnX(steps.length) : columnX(0)
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
        animate={boom ? { rotate: [0, -40, -25], scale: [1, 1.3, 0.85], opacity: 0.6 } : { rotate: 0, scale: 1, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="size-full"
      >
        <motion.img
          key={steps.length + (arrived ? 1 : 0)}
          src={championIconById(champion)}
          alt=""
          animate={{ y: [0, -14, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 0.35 }}
          className={`size-full rounded-full border-2 shadow-lg shadow-black/60 ${you ? 'border-hextech' : 'border-red-400'} ${boom ? 'grayscale' : ''}`}
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

/** B: a flag at the finish, or on the goal line in one-role games. */
function FinishMark({ goal }: { goal: number | null }) {
  if (goal !== null) {
    return (
      <div className="absolute top-0 h-[16%] -translate-x-1/2" style={{ left: `${goalX(goal)}%` }} aria-hidden="true">
        <Flag className="h-full" />
      </div>
    )
  }
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
function LaneArt({ arrows, goal }: { arrows: boolean; goal: number | null }) {
  const id = useId()
  const goalLineX = goal === null ? null : (goal + 1) * COLUMN_WIDTH
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
      {goalLineX !== null && (
        <line x1={goalLineX} y1={LANE_TOP - 6} x2={goalLineX} y2={LANE_BOTTOM + 6} stroke="#c8aa6e" strokeWidth="3" strokeDasharray="6 5" />
      )}
    </svg>
  )
}

/** "Master Yi wants to go from A to B": a dashed, moving arrow along the lane. */
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

/** 1: Teemo plants 3 shrooms on the path. 2: one shroom per column, the other spot is ✕. 3: Yi hops to the flag. */
export function ShroomTutorialArt({ step }: TutorialArtProps) {
  if (step === 0) return <PlantArt />
  if (step === 1) return <OnePerColumnArt />
  return <WalkArt />
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
        src={championIconById('Teemo')}
        alt=""
        className="absolute right-0.5 bottom-0.5 size-[30%] rounded-full border-2 border-hextech shadow-md shadow-black/60"
      />
    </div>
  )
}

function OnePerColumnArt() {
  return (
    <div className={`flex size-full flex-col items-center justify-center gap-[8%] ${MINI_LANE}`}>
      <span className="relative flex aspect-square w-[36%] items-center justify-center rounded-full border-2 border-hextech bg-hextech/20">
        <img src={SHROOM_ICON} alt="" className="absolute size-[88%] rounded-full" />
      </span>
      <motion.span
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="flex aspect-square w-[36%] items-center justify-center rounded-full border-2 border-dashed border-amber-100/40 bg-stone-950/50"
      >
        <span className="text-xl font-black text-red-400 sm:text-3xl">✕</span>
      </motion.span>
    </div>
  )
}

function WalkArt() {
  return (
    <div className={`relative size-full ${MINI_LANE}`}>
      <div className="absolute inset-y-[16%] right-[16%] left-[18%] grid grid-cols-3 grid-rows-2 place-items-center">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} className="aspect-square w-[62%] rounded-full border-2 border-hextech/80 bg-hextech/20 shadow-[0_0_8px_rgb(10_200_185/0.7)]" />
        ))}
      </div>
      <Flag className="absolute top-1/2 right-[2%] h-[30%] -translate-y-1/2" />
      <motion.img
        src={championIconById('MasterYi')}
        alt=""
        animate={{ left: ['8%', '29%', '51%', '73%', '90%'], top: ['50%', '33%', '67%', '33%', '50%'] }}
        transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.5 }}
        className="absolute size-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-400 shadow-md shadow-black/60"
      />
    </div>
  )
}
