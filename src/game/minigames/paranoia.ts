import { seededRandom } from '../random'
import { isLane, LANE_SPOTS, LANES, randomLane, type Lane, type MapPoint } from './riftLanes'
import { stepSeed, type BothMoves, type GameSetup, type MiniGameRules, type Owed, type Player, type Settled } from './versus'

/**
 * Paranoia: the lights go out and Nocturne flies at one of the three lanes, seen only in short
 * flickers. Sometimes he heads for one lane, then turns for another (at least one flicker always
 * shows after the turn, so it can be read). When the flickers stop, call his lane before he
 * lands. Three rounds, each darker: fewer and shorter flickers, more fake-outs, and he is seen
 * less far into his flight. Most right calls win, then the faster ones.
 */
export const PARANOIA_ROUNDS = [
  { flickers: 7, flickerMs: 220, gapMs: 420, reach: 0.8, fakeChance: 0.35 },
  { flickers: 6, flickerMs: 160, gapMs: 360, reach: 0.72, fakeChance: 0.6 },
  { flickers: 5, flickerMs: 110, gapMs: 320, reach: 0.64, fakeChance: 0.85 },
] as const

export const PARANOIA_TIMING = {
  /** The lights go out before the first flicker (longer in the first round, to get ready). */
  darkMs: 1300,
  firstDarkMs: 2000,
  /** Time to call the lane after the last flicker: then he lands. Speed counts, so it is short. */
  pickMs: 3000,
  /** A finished round stays up this long before the next one. */
  betweenMs: 2800,
} as const

export const paranoiaRoundCount = (): number => PARANOIA_ROUNDS.length

/** Where Nocturne starts: by one of the two bases, away from all three lanes. */
const STARTS: readonly MapPoint[] = [
  { x: 80, y: 20 },
  { x: 20, y: 80 },
]
/** How far toward the fake lane he flies before turning, as a share of the way. */
const TURN = { min: 0.35, max: 0.55 }
/** The first flicker shows this far into the flight. */
const FIRST_FLICKER = 0.08
/** With a fake-out, the last flicker is at least this far past the turn. */
const AFTER_TURN = 0.12

export interface Flight {
  /** The lane he lands in. */
  lane: Lane
  /** The lane he first heads for, when he fakes one. */
  fake: Lane | null
  /** His way: the start, the turn (for a fake-out), and the lane. */
  path: MapPoint[]
  /** Where each flicker shows him, in order. */
  flickers: MapPoint[]
  flickerMs: number
  gapMs: number
}

const distance = (a: MapPoint, b: MapPoint) => Math.hypot(b.x - a.x, b.y - a.y)
const lerp = (a: MapPoint, b: MapPoint, t: number): MapPoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

/** The point `share` (0–1) of the way along a path. */
export function pointAlong(path: readonly MapPoint[], share: number): MapPoint {
  const legs = path.slice(1).map((point, index) => distance(path[index] ?? point, point))
  let left = Math.max(0, Math.min(1, share)) * legs.reduce((total, leg) => total + leg, 0)
  for (let index = 0; index < legs.length; index++) {
    const leg = legs[index] ?? 0
    const from = path[index]
    const to = path[index + 1]
    if (!from || !to) break
    if (left <= leg || index === legs.length - 1) return lerp(from, to, leg === 0 ? 1 : Math.min(1, left / leg))
    left -= leg
  }
  return path[path.length - 1] ?? { x: 50, y: 50 }
}

/** The flight of one round, the same for everyone with the same seed. */
export function paranoiaFlight(seed: number, round: number): Flight {
  const config = PARANOIA_ROUNDS[Math.min(round, PARANOIA_ROUNDS.length - 1)] ?? PARANOIA_ROUNDS[0]
  const random = seededRandom(seed)
  const lane = randomLane(random)
  const base = STARTS[random() < 0.5 ? 0 : 1] ?? { x: 80, y: 20 }
  const start = { x: base.x + (random() - 0.5) * 10, y: base.y + (random() - 0.5) * 10 }
  const target = LANE_SPOTS[lane]
  const otherLanes = LANES.filter((other) => other !== lane)
  const fake = random() < config.fakeChance ? (otherLanes[Math.floor(random() * otherLanes.length)] ?? null) : null

  const turn = fake === null ? null : lerp(start, LANE_SPOTS[fake], TURN.min + random() * (TURN.max - TURN.min))
  const path = turn ? [start, turn, target] : [start, target]
  const total = distance(start, turn ?? target) + (turn ? distance(turn, target) : 0)
  const turnShare = turn ? distance(start, turn) / total : 0
  const reach = Math.min(0.95, Math.max(config.reach, turn ? turnShare + AFTER_TURN : 0))

  const flickers = Array.from({ length: config.flickers }, (_, index) => {
    const even = FIRST_FLICKER + ((reach - FIRST_FLICKER) * index) / Math.max(1, config.flickers - 1)
    // A little uneven, but never past the last one.
    const wobble = index === 0 || index === config.flickers - 1 ? 0 : (random() - 0.5) * 0.04
    return pointAlong(path, even + wobble)
  })
  return { lane, fake, path, flickers, flickerMs: config.flickerMs, gapMs: config.gapMs }
}

/** The flight of one step of the game. */
export const flightOfStep = (setup: GameSetup, step: number): Flight => paranoiaFlight(stepSeed(setup.seed, step, 91), step)

/** When the flickers start, in ms from the round's start. */
export const flightStartMs = (step: number): number => (step === 0 ? PARANOIA_TIMING.firstDarkMs : PARANOIA_TIMING.darkMs)

/** How long the flickers take, from the first one showing to the last one going out. */
export const flickersMs = (flight: Flight): number => (flight.flickers.length - 1) * flight.gapMs + flight.flickerMs

/** When the call opens, in ms from the round's start. */
export const callOpensMs = (flight: Flight, step: number): number => flightStartMs(step) + flickersMs(flight)

// ── Moves: a call is the lane and how fast, packed in one number ─────────

/** The slowest call that counts, in ms. */
export const CALL_CAP_MS = PARANOIA_TIMING.pickMs
/** "Lane" 3 means no call in time. */
const NO_LANE = 3

export interface Call {
  /** Null when time ran out. */
  lane: Lane | null
  ms: number
}

export const callMove = (lane: Lane | null, ms: number): number => Math.min(CALL_CAP_MS, Math.max(0, Math.round(ms))) * 4 + (lane ?? NO_LANE)

export function readCall(move: number): Call {
  const lane = move % 4
  return { lane: isLane(lane) ? lane : null, ms: Math.floor(move / 4) }
}

/** The move for a player who never called: no lane, at the time limit. */
export const NO_CALL = callMove(null, CALL_CAP_MS)

export interface CallResult extends Call {
  right: boolean
}

/** Each player's calls so far, by round. */
export function paranoiaCalls(moves: BothMoves, setup: GameSetup): [CallResult[], CallResult[]] {
  const calls: [CallResult[], CallResult[]] = [[], []]
  for (let step = 0; step < paranoiaRoundCount(); step++) {
    const { lane } = flightOfStep(setup, step)
    for (const player of [0, 1] as const) {
      const move = moves[player][step]
      if (move === undefined) continue
      const call = readCall(move)
      calls[player].push({ ...call, right: call.lane === lane })
    }
  }
  return calls
}

// ── Scores: right calls, then speed ─────────

/** A score is right calls × SCORE_BASE plus a bonus for speed on them, so higher is always better. */
export const SCORE_BASE = 100_000

export function paranoiaScore(calls: readonly CallResult[]): number {
  const right = calls.filter((call) => call.right)
  if (right.length === 0) return 0
  const ms = Math.min(
    SCORE_BASE - 1,
    right.reduce((total, call) => total + call.ms, 0),
  )
  return right.length * SCORE_BASE + (SCORE_BASE - 1 - ms)
}

/** "2/3 · 1.4 s": right calls, and the time they took. */
export function formatParanoiaScore(score: number): string {
  const right = `${Math.floor(score / SCORE_BASE)}/${paranoiaRoundCount()}`
  return score === 0 ? right : `${right} · ${((SCORE_BASE - 1 - (score % SCORE_BASE)) / 1000).toFixed(1)} s`
}

function settle(moves: BothMoves, setup: GameSetup): Settled | null {
  const rounds = paranoiaRoundCount()
  const [mine, theirs] = paranoiaCalls(moves, setup)
  if (mine.length < rounds || theirs.length < rounds) return null
  const scores: [number, number] = [paranoiaScore(mine), paranoiaScore(theirs)]
  const winner: Player | null = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1
  return { winner, scores }
}

function owed(moves: BothMoves): Owed[] {
  return ([0, 1] as const).flatMap((player) => {
    const missing = moves[player].findIndex((move) => move === undefined)
    const next = missing === -1 ? moves[player].length : missing
    return next < paranoiaRoundCount() ? [{ player, step: next }] : []
  })
}

/**
 * Ekko, the bot: right about 80, 60 and 45% of the time as the rounds get darker (a fake-out
 * fools him more), calling in 0.55–1.4 s, a little slower each round.
 */
export const BOT_PARANOIA = { accuracy: [0.82, 0.62, 0.45], fooled: 0.15, callMs: { min: 550, max: 1400 }, slowerPerRound: 120 } as const

export function botCall(flight: Flight, step: number, seed: number): number {
  const random = seededRandom(seed ^ 0x6c8e9cf5)
  const base = BOT_PARANOIA.accuracy[Math.min(step, BOT_PARANOIA.accuracy.length - 1)] ?? 0.6
  const accuracy = flight.fake === null ? base : base - BOT_PARANOIA.fooled
  const wrong = LANES.filter((lane) => lane !== flight.lane)
  // Fooled: he usually falls for the fake lane.
  const wrongLane = flight.fake ?? wrong[Math.floor(random() * wrong.length)] ?? flight.lane
  const lane = random() < accuracy ? flight.lane : wrongLane
  const ms = BOT_PARANOIA.callMs.min + random() * (BOT_PARANOIA.callMs.max - BOT_PARANOIA.callMs.min) + step * BOT_PARANOIA.slowerPerRound
  return callMove(lane, ms)
}

/** The longest a round can take on screen, in ms. */
export function paranoiaRoundMs(step: number, setup: GameSetup): number {
  return callOpensMs(flightOfStep(setup, step), step) + PARANOIA_TIMING.pickMs + PARANOIA_TIMING.betweenMs
}

export const PARANOIA_RULES: MiniGameRules = {
  chances: 1,
  liveSeconds: (setup) =>
    Math.ceil(Array.from({ length: paranoiaRoundCount() }, (_, step) => paranoiaRoundMs(step, setup)).reduce((a, b) => a + b, 0) / 1000),
  owed,
  settle,
  fallback: () => NO_CALL,
  botMove: (step, _moves, setup) =>
    step < paranoiaRoundCount() ? botCall(flightOfStep(setup, step), step, stepSeed(setup.seed, step, 93)) : undefined,
  formatScore: (score) => formatParanoiaScore(score),
  best: { of: (moves, setup) => (settle(moves, setup) ? paranoiaScore(paranoiaCalls(moves, setup)[0]) : null), lowerIsBetter: false, format: formatParanoiaScore },
}
