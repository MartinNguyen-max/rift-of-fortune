import { seededRandom } from '../random'
import { stepSeed, type BothMoves, type GameSetup, type MiniGameRules, type Owed, type Player, type Settled } from './versus'

/**
 * Sion's Unstoppable Onslaught, like curling: hold to charge, faster and faster; let go and Sion
 * brakes and slides. The slide grows with the speed squared, so you judge when to let go. Stop in
 * the zone where the enemy team stands. Past the zone is their tower: reaching it is a crash.
 * Distances are in meters from the start.
 */
export const RACE = {
  /** Runs per game, solo and Multiplayer alike: the same seeded tracks for both players. */
  runs: 3,
  /** Braking once you let go, in m/s². The same on every track, so the slide can be learned. */
  brake: 22,
  /** How hard Sion speeds up while held: speed = boost·t + surge·t² (t in seconds). */
  boost: { min: 7, max: 9.5 },
  surge: { min: 2, max: 3.2 },
  /** The middle of the target zone. */
  target: { min: 45, max: 78 },
  /** From the target to the tower; some tracks put the target close to it. */
  gap: { min: 11, max: 22 },
  nearGap: { min: 7, max: 10 },
  nearChance: 0.3,
  /** Seconds after GO to start holding, and the longest hold (always a crash by then). */
  startSeconds: 6,
  maxHoldSeconds: 6,
} as const

/** Scoring around the target's middle: 100 within `perfect`, then `perMeter` less for each meter off. `zone` is drawn. */
export const RACE_SCORE = { perfect: 1.5, zone: 6, perMeter: 5 } as const

export interface RaceTrack {
  /** The middle of the target zone, in meters. */
  target: number
  /** The enemy tower. Reaching it is a crash. */
  tower: number
  boost: number
  surge: number
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
    boost: between(RACE.boost.min, RACE.boost.max, random),
    surge: between(RACE.surge.min, RACE.surge.max, random),
  }
}

/** The track of one run, the same for both players. */
export const trackOfRun = (setup: GameSetup, run: number): RaceTrack => raceTrack(stepSeed(setup.seed, run, 53))

/** Speed (m/s) after holding for `seconds`. */
export const holdSpeed = ({ boost, surge }: RaceTrack, seconds: number): number => boost * seconds + surge * seconds * seconds

/** Distance covered (m) after holding for `seconds`. */
export const holdDistance = ({ boost, surge }: RaceTrack, seconds: number): number =>
  (boost * seconds * seconds) / 2 + (surge * seconds * seconds * seconds) / 3

/** When Sion reaches the tower while still holding: the latest you can let go without crashing into it. */
export function crashSeconds(track: RaceTrack): number {
  let low = 0
  let high: number = RACE.maxHoldSeconds
  for (let index = 0; index < 40; index++) {
    const middle = (low + high) / 2
    if (holdDistance(track, middle) >= track.tower) high = middle
    else low = middle
  }
  return high
}

export interface RunOutcome {
  /** Where Sion stopped (at the tower for a crash). */
  stop: number
  crashed: boolean
  /** Meters from the target's middle (negative = short). */
  offset: number
  score: number
  /** How long the hold was, and the slide after it, in seconds. */
  holdSeconds: number
  slideSeconds: number
}

/** A run from the hold time in ms: where Sion stops, and the points for it. */
export function runOutcome(track: RaceTrack, holdMs: number): RunOutcome {
  const holdSeconds = Math.min(Math.max(0, holdMs), RACE.maxHoldSeconds * 1000) / 1000
  const speed = holdSpeed(track, holdSeconds)
  const stop = holdDistance(track, holdSeconds) + (speed * speed) / (2 * RACE.brake)
  const crashed = stop >= track.tower
  const finalStop = crashed ? track.tower : stop
  const offset = finalStop - track.target
  return {
    stop: finalStop,
    crashed,
    offset,
    score: crashed ? 0 : runScore(Math.abs(offset)),
    holdSeconds: Math.min(holdSeconds, crashed ? crashSeconds(track) : holdSeconds),
    slideSeconds: speed / RACE.brake,
  }
}

/** 100 within 1.5 m of the middle, 5 points less for every meter further, never below 0. */
export function runScore(distance: number): number {
  if (distance <= RACE_SCORE.perfect) return 100
  return Math.max(0, Math.round(100 - (distance - RACE_SCORE.perfect) * RACE_SCORE.perMeter))
}

/** The hold (in seconds) that stops Sion exactly at `aim`. Holding longer always slides further. */
export function holdFor(track: RaceTrack, aim: number): number {
  let low = 0
  let high: number = RACE.maxHoldSeconds
  for (let index = 0; index < 40; index++) {
    const middle = (low + high) / 2
    const speed = holdSpeed(track, middle)
    const stop = holdDistance(track, middle) + (speed * speed) / (2 * RACE.brake)
    if (stop >= aim) high = middle
    else low = middle
  }
  return high
}

// ── The mini-game: one move per run, the hold time in ms ─────────

/** A player who never ran: Sion stays at the start, which scores 0. */
export const NO_RUN = 0

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
 * middle, or greedy toward the tower) and lets go a little early or late, more so on harder
 * tracks where the tower is close.
 */
export const BOT_RACE = {
  plans: [
    { chance: 0.3, aim: -5 },
    { chance: 0.45, aim: 0 },
    { chance: 0.25, aim: 6 },
  ],
  /** Timing error in seconds: up to this much early or late, more near the tower. */
  error: 0.12,
  nearError: 0.16,
} as const

export function botRun(track: RaceTrack, seed: number): number {
  const random = seededRandom(seed ^ 0x2545f491)
  const roll = random()
  let chance = 0
  const plan = BOT_RACE.plans.find((entry) => (chance += entry.chance) > roll) ?? BOT_RACE.plans[1]
  const near = track.tower - track.target < RACE.gap.min
  const error = (random() * 2 - 1) * (near ? BOT_RACE.nearError : BOT_RACE.error)
  return Math.round(Math.max(0, holdFor(track, track.target + plan.aim) + error) * 1000)
}

const formatPoints = (points: number) => `${points} ${points === 1 ? 'pt' : 'pts'}`

/** Each run: the 3-2-1, time to start, the longest hold, the slide and a look at both stops. */
const RUN_SECONDS = 3 + RACE.startSeconds + RACE.maxHoldSeconds + 3 + 3.5

export const RACE_RULES: MiniGameRules = {
  chances: 1,
  liveSeconds: () => Math.ceil(RACE.runs * RUN_SECONDS),
  owed,
  settle,
  fallback: () => NO_RUN,
  botMove: (step, _moves, setup) => (step < RACE.runs ? botRun(trackOfRun(setup, step), stepSeed(setup.seed, step, 59)) : undefined),
  formatScore: (score) => formatPoints(score),
  best: { of: (moves, setup) => settle(moves, setup)?.scores[0] ?? null, lowerIsBetter: false, format: formatPoints },
}
