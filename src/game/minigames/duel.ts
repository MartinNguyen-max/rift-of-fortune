import { seededRandom, type RandomFn } from '../random'
import { other, type BothMoves, type MiniGameRules, type Owed, type Player, type Settled } from './versus'

/** First to this many rounds wins the duel (best of 3). */
export const DUEL_ROUNDS_TO_WIN = 2
export const DUEL_MAX_ROUNDS = DUEL_ROUNDS_TO_WIN * 2 - 1

/** Seconds of "Ready... Steady..." before DRAW, picked at random so it can't be timed. */
export const DRAW_DELAY = { min: 1.8, max: 4.8 } as const

/** Seconds after DRAW until a player who never shot loses the round. */
export const SHOT_WINDOW = 1.5

/** A move for a player who never shot (in ms), later than any real shot. */
export const NO_SHOT = 60_000

/** The bot's reaction time in seconds after DRAW. A good human reacts in about 0.25 s. */
export const BOT_REACTION = { min: 0.26, max: 0.42 } as const

/** How often the bot gets nervous and shoots before DRAW. */
export const BOT_FALSE_START_CHANCE = 0.08

const between = (min: number, max: number, random: RandomFn) => min + random() * (max - min)

/** When DRAW shows in each round, in ms from the round start. The same for both players. */
export function drawTimes(seed: number): number[] {
  const random = seededRandom(seed)
  return Array.from({ length: DUEL_MAX_ROUNDS }, () => Math.round(between(DRAW_DELAY.min, DRAW_DELAY.max, random) * 1000))
}

/** The bot's shot in each round, in ms from the round start: after DRAW, or before it on a false start. */
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
  /** 'early': the loser shot before DRAW. 'faster': the winner shot first after DRAW. */
  reason: DuelRoundReason
  /** Each player's ms from DRAW to their shot, or null for a shot before DRAW or no shot. */
  reactions: [number | null, number | null]
}

const reaction = (shot: number, drawAt: number) => (shot >= drawAt && shot < NO_SHOT ? shot - drawAt : null)

/**
 * The first one to jump the gun loses; otherwise the first shot after DRAW wins. Shots are in ms
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
