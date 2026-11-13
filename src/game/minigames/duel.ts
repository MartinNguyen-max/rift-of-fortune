import { seededRandom, type RandomFn } from '../random'
import { other, type BothMoves, type MiniGameRules, type Owed, type Player, type Settled } from './versus'

/** First to this many rounds wins the duel (best of 3). */
export const DUEL_ROUNDS_TO_WIN = 2
export const DUEL_MAX_ROUNDS = DUEL_ROUNDS_TO_WIN * 2 - 1

/**
 * Headshot at High Noon: "Ready... Steady..." then a Baron pops up somewhere in the arena. Tap it
 * first to win the round; tap before it shows and the round is lost. A tap that misses the Baron
 * only costs time. Best of 3. A move is the time of your tap in ms from the round start.
 */

/** Seconds of "Ready... Steady..." before the Baron shows, picked at random so it can't be timed. */
export const DRAW_DELAY = { min: 1.8, max: 4.8 } as const

/** Seconds after the Baron shows until a player who never tapped it loses the round. */
export const SHOT_WINDOW = 1.5

/** A move for a player who never shot (in ms), later than any real shot. */
export const NO_SHOT = 60_000

/**
 * The bot's time from the Baron showing to its tap, in seconds. Seeing it and moving a finger or
 * a mouse there takes a quick human about 0.35–0.5 s.
 */
export const BOT_REACTION = { min: 0.38, max: 0.6 } as const

/** How often the bot gets nervous and shoots before the Baron shows. */
export const BOT_FALSE_START_CHANCE = 0.06

/** Where the Baron can show, as fractions of the arena (its center): clear of the edges. */
export const TARGET_AREA = { left: 0.2, right: 0.8, top: 0.2, bottom: 0.62 } as const

/** Where the Baron shows: the center, as fractions of the arena's width and height. */
export interface TargetSpot {
  x: number
  y: number
}

const between = (min: number, max: number, random: RandomFn) => min + random() * (max - min)

/**
 * Where the Baron shows in each round, the same for both players. Each round it jumps to the
 * other half of the arena, so no spot can be camped.
 */
export function targetSpots(seed: number): TargetSpot[] {
  const random = seededRandom(seed ^ 0x3c6ef372)
  const firstRight = random() < 0.5
  const middle = (TARGET_AREA.left + TARGET_AREA.right) / 2
  return Array.from({ length: DUEL_MAX_ROUNDS }, (_, round) => {
    const right = (round % 2 === 0) === firstRight
    const x = right ? between(middle + 0.05, TARGET_AREA.right, random) : between(TARGET_AREA.left, middle - 0.05, random)
    return { x, y: between(TARGET_AREA.top, TARGET_AREA.bottom, random) }
  })
}

/** When the Baron shows in each round, in ms from the round start. The same for both players. */
export function drawTimes(seed: number): number[] {
  const random = seededRandom(seed)
  return Array.from({ length: DUEL_MAX_ROUNDS }, () => Math.round(between(DRAW_DELAY.min, DRAW_DELAY.max, random) * 1000))
}

/** The bot's tap in each round, in ms from the round start: after the Baron shows, or before on a false start. */
export function botShots(seed: number): number[] {
  const random = seededRandom(seed ^ 0x6a09e667)
  return drawTimes(seed).map((drawAt) => {
    const falseStart = random() < BOT_FALSE_START_CHANCE
    const offset = falseStart ? -between(0.3, 0.9, random) : between(BOT_REACTION.min, BOT_REACTION.max, random)
    return Math.round(drawAt + offset * 1000)
  })
}

export type DuelRoundReason = 'faster' | 'early'

export interface DuelRoundResult {
  winner: Player
  /** 'early': the loser tapped before the Baron showed. 'faster': the winner tapped it first. */
  reason: DuelRoundReason
  /** Each player's ms from the Baron showing to their tap, or null for an early tap or none. */
  reactions: [number | null, number | null]
}

const reaction = (shot: number, drawAt: number) => (shot >= drawAt && shot < NO_SHOT ? shot - drawAt : null)

/**
 * The first one to jump the gun loses; otherwise the first tap on the Baron wins. Shots are in ms
 * from the round start. A dead heat goes to player 0 in even rounds and player 1 in odd ones.
 */
export function duelRound(drawAt: number, shots: readonly [number, number], round: number): DuelRoundResult {
  const reactions: [number | null, number | null] = [reaction(shots[0], drawAt), reaction(shots[1], drawAt)]
  const early = shots.map((shot) => shot < drawAt)
  if (early[0] || early[1]) {
    // Both early: the one who shot first jumped the gun first.
    const loser: Player = early[0] && (!early[1] || shots[0] <= shots[1]) ? 0 : 1
    return { winner: other(loser), reason: 'early', reactions }
  }
  const winner: Player = shots[0] === shots[1] ? (round % 2 === 0 ? 0 : 1) : shots[0] < shots[1] ? 0 : 1
  return { winner, reason: 'faster', reactions }
}

/** Every round both players have shot in, stopping once the duel is won. */
export function duelResults(moves: BothMoves, seed: number): DuelRoundResult[] {
  const draws = drawTimes(seed)
  const results: DuelRoundResult[] = []
  for (let round = 0; round < DUEL_MAX_ROUNDS; round++) {
    const a = moves[0][round]
    const b = moves[1][round]
    const drawAt = draws[round]
    if (a === undefined || b === undefined || drawAt === undefined || duelWinner(results) !== null) break
    results.push(duelRound(drawAt, [a, b], round))
  }
  return results
}

export const roundsWon = (results: readonly DuelRoundResult[], player: Player): number =>
  results.filter(({ winner }) => winner === player).length

/** The duel winner once someone has won enough rounds, otherwise null. */
export function duelWinner(results: readonly DuelRoundResult[]): Player | null {
  if (roundsWon(results, 0) >= DUEL_ROUNDS_TO_WIN) return 0
  if (roundsWon(results, 1) >= DUEL_ROUNDS_TO_WIN) return 1
  return null
}

/** A player's best reaction in the duel, in ms. */
export function bestReaction(results: readonly DuelRoundResult[], player: Player): number | null {
  const times = results.map(({ reactions }) => reactions[player]).filter((time): time is number => time !== null)
  return times.length > 0 ? Math.min(...times) : null
}

function settle(moves: BothMoves, seed: number): Settled | null {
  const results = duelResults(moves, seed)
  const winner = duelWinner(results)
  if (winner === null) return null
  return { winner, scores: [roundsWon(results, 0), roundsWon(results, 1)] }
}

export const DUEL_RULES: MiniGameRules = {
  chances: 1,
  liveSeconds: () => DUEL_MAX_ROUNDS * (DRAW_DELAY.max + SHOT_WINDOW + 3),
  owed: (moves, { seed }) => {
    if (settle(moves, seed)) return []
    const round = duelResults(moves, seed).length
    return ([0, 1] as const).filter((player) => moves[player][round] === undefined).map((player): Owed => ({ player, step: round }))
  },
  settle: (moves, { seed }) => settle(moves, seed),
  fallback: () => NO_SHOT,
  botMove: (step, _moves, { seed }) => (step < DUEL_MAX_ROUNDS ? botShots(seed)[step] : undefined),
  formatScore: (score) => `${score} ${score === 1 ? 'round' : 'rounds'}`,
  best: {
    of: (moves, { seed }) => bestReaction(duelResults(moves, seed), 0),
    lowerIsBetter: true,
    format: (ms) => `${ms} ms`,
  },
}
