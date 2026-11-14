import { seededRandom } from '../random'
import { stepSeed, type BothMoves, type GameSetup, type MiniGameRules, type Owed, type Player, type Settled } from './versus'

/**
 * Sion's Unstoppable Onslaught: at GO Sion charges down the lane by himself, faster and faster.
 * Tap STOP and he stops right there. Stop in the zone where the enemy team stands; past the zone
 * is their tower, and reaching it is a crash. Distances are in meters from the start.
 */
export const RACE = {
  /** Runs per game, solo and Multiplayer alike: the same seeded tracks for both players. */
  runs: 3,
  /** Sion's speed at GO (m/s), and how fast it grows (m/s²). Each track is a little different. */
  start: { min: 10, max: 14 },
  accel: { min: 9, max: 14 },
  /** The middle of the target zone. */
  target: { min: 45, max: 78 },
  /** From the target to the tower; some tracks put the target close to it. */
  gap: { min: 11, max: 22 },
  nearGap: { min: 5, max: 8 },
  nearChance: 0.3,
  /** The longest a run can last: Sion always reaches the tower before this. */
  maxRunSeconds: 6,
} as const

/**
 * Scoring around the target's middle: 100 within `perfect` (a hair: about 10 ms at full speed),
 * then `perMeter` less for each meter off. `zone` is drawn.
 */
export const RACE_SCORE = { perfect: 0.4, zone: 3, perMeter: 10 } as const

export interface RaceTrack {
  /** The middle of the target zone, in meters. */
  target: number
  /** The enemy tower. Reaching it is a crash. */
  tower: number
  /** Speed at GO, m/s. */
  start: number
  /** Speed gained each second, m/s². */
  accel: number
}

const between = (min: number, max: number, random: () => number) => min + random() * (max - min)

export function raceTrack(seed: number): RaceTrack {
  const random = seededRandom(seed)
  const target = between(RACE.target.min, RACE.target.max, random)
  const near = random() < RACE.nearChance
  const gap = near ? between(RACE.nearGap.min, RACE.nearGap.max, random) : between(RACE.gap.min, RACE.gap.max, random)
  return {
    target,
    tower: target + gap,
    start: between(RACE.start.min, RACE.start.max, random),
    accel: between(RACE.accel.min, RACE.accel.max, random),
  }
}

/** The track of one run, the same for both players. */
export const trackOfRun = (setup: GameSetup, run: number): RaceTrack => raceTrack(stepSeed(setup.seed, run, 53))

/** Speed (m/s) `seconds` after GO. */
export const runSpeed = ({ start, accel }: RaceTrack, seconds: number): number => start + accel * seconds

/** Distance covered (m) `seconds` after GO. */
export const runDistance = ({ start, accel }: RaceTrack, seconds: number): number => start * seconds + (accel * seconds * seconds) / 2

/** When Sion reaches a spot (seconds after GO). */
export function secondsTo({ start, accel }: RaceTrack, meters: number): number {
  return (-start + Math.sqrt(start * start + 2 * accel * Math.max(0, meters))) / accel
}

/** When Sion reaches the tower: tap before this or crash. */
export const crashSeconds = (track: RaceTrack): number => secondsTo(track, track.tower)

export interface RunOutcome {
  /** Where Sion stopped (at the tower for a crash). */
  stop: number
  crashed: boolean
  /** Meters from the target's middle (negative = short). */
  offset: number
  score: number
}

/** A run from the tap time in ms after GO: where Sion stops, and the points for it. */
export function runOutcome(track: RaceTrack, stopMs: number): RunOutcome {
  const seconds = Math.max(0, stopMs) / 1000
  const crashed = seconds >= crashSeconds(track)
  const stop = crashed ? track.tower : runDistance(track, seconds)
  const offset = stop - track.target
  return { stop, crashed, offset, score: crashed ? 0 : runScore(Math.abs(offset)) }
}

/** 100 within 0.4 m of the middle, 10 points less for every meter further, never below 0. */
export function runScore(distance: number): number {
  if (distance <= RACE_SCORE.perfect) return 100
  return Math.max(0, Math.round(100 - (distance - RACE_SCORE.perfect) * RACE_SCORE.perMeter))
}

// ── The mini-game: one move per run, the tap time in ms after GO ─────────

/** A player who never tapped STOP: Sion runs into the tower. */
export const NO_STOP = 60_000

/** Each player's outcome per run played so far. */
export function raceOutcomes(moves: BothMoves, setup: GameSetup): [RunOutcome[], RunOutcome[]] {
  const outcomes: [RunOutcome[], RunOutcome[]] = [[], []]
  for (let run = 0; run < RACE.runs; run++) {
    const track = trackOfRun(setup, run)
    for (const player of [0, 1] as const) {
      const move = moves[player][run]
      if (move !== undefined) outcomes[player].push(runOutcome(track, move))
    }
  }
  return outcomes
}

export const totalScore = (outcomes: readonly RunOutcome[]): number => outcomes.reduce((total, { score }) => total + score, 0)

/** The closest stop to a target's middle, crashes left out (Infinity without one). */
export const closestRun = (outcomes: readonly RunOutcome[]): number =>
  Math.min(Infinity, ...outcomes.filter(({ crashed }) => !crashed).map(({ offset }) => Math.abs(offset)))

/** Most points wins; equal points go to the closest single run; equal on both is a tie. */
export function raceWinner(mine: readonly RunOutcome[], theirs: readonly RunOutcome[]): Player | null {
  const [a, b] = [totalScore(mine), totalScore(theirs)]
  if (a !== b) return a > b ? 0 : 1
  const [closeA, closeB] = [closestRun(mine), closestRun(theirs)]
  if (closeA !== closeB) return closeA < closeB ? 0 : 1
  return null
}

function settle(moves: BothMoves, setup: GameSetup): Settled | null {
  const [mine, theirs] = raceOutcomes(moves, setup)
  if (mine.length < RACE.runs || theirs.length < RACE.runs) return null
  return { winner: raceWinner(mine, theirs), scores: [totalScore(mine), totalScore(theirs)] }
}

function owed(moves: BothMoves): Owed[] {
  return ([0, 1] as const).flatMap((player) => {
    const missing = moves[player].findIndex((move) => move === undefined)
    const next = missing === -1 ? moves[player].length : missing
    return next < RACE.runs ? [{ player, step: next }] : []
  })
}

/**
 * Vi, the bot: she charges too. Each run she picks a plan (careful and short, steady for the
 * middle, or greedy toward the tower) and stops a little early or late, more so on harder
 * tracks where the tower is close.
 */
export const BOT_RACE = {
  plans: [
    { chance: 0.3, aim: -2.5 },
    { chance: 0.45, aim: 0 },
    { chance: 0.25, aim: 6 },
  ],
  /** Timing error in seconds: up to this much early or late, more near the tower. */
  error: 0.05,
  nearError: 0.065,
} as const

export function botRun(track: RaceTrack, seed: number): number {
  const random = seededRandom(seed ^ 0x2545f491)
  const roll = random()
  let chance = 0
  const plan = BOT_RACE.plans.find((entry) => (chance += entry.chance) > roll) ?? BOT_RACE.plans[1]
  const near = track.tower - track.target < RACE.gap.min
  const error = (random() * 2 - 1) * (near ? BOT_RACE.nearError : BOT_RACE.error)
  return Math.round(Math.max(0, secondsTo(track, track.target + plan.aim) + error) * 1000)
}

const formatPoints = (points: number) => `${points} ${points === 1 ? 'pt' : 'pts'}`

/** Each run: the 3-2-1, the longest run and a look at both stops. */
const RUN_SECONDS = 3 + RACE.maxRunSeconds + 3.5

export const RACE_RULES: MiniGameRules = {
  chances: 1,
  liveSeconds: () => Math.ceil(RACE.runs * RUN_SECONDS),
  owed,
  settle,
  fallback: () => NO_STOP,
  botMove: (step, _moves, setup) => (step < RACE.runs ? botRun(trackOfRun(setup, step), stepSeed(setup.seed, step, 59)) : undefined),
  formatScore: (score) => formatPoints(score),
  best: { of: (moves, setup) => settle(moves, setup)?.scores[0] ?? null, lowerIsBetter: false, format: formatPoints },
}
