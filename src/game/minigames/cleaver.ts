import { seededRandom, type RandomFn } from '../random'
import {
  firstPlayer,
  other,
  stepSeed,
  type BothMoves,
  type GameSetup,
  type MiniGameRules,
  type Owed,
  type Player,
  type Settled,
  type Variant,
} from './versus'

/**
 * Mundo Goes Where He Pleases: each Mundo stands on one of three spots on their side. Every turn
 * one throws a cleaver at a spot and the other dodges, moving at most one spot (from top: top or
 * mid). Both choose at the same time. The roles switch every turn.
 * A move is a spot (0 top, 1 mid, 2 bot): the target for the thrower, the new spot for the dodger.
 */
export const SPOTS = ['top', 'mid', 'bot'] as const
export type Spot = 0 | 1 | 2
export const START_SPOT: Spot = 1

/** Cleaver hits to win. */
export const CLEAVER_HITS_TO_WIN = 3
/** The most turns a game lasts; then the Mundo who landed more cleavers wins. Multiplayer is short. */
export const MAX_TURNS: Record<Variant, number> = { solo: 12, live: 6 }
/** Seconds to choose each turn. */
export const TURN_SECONDS: Record<Variant, number> = { solo: 4, live: 5 }

export const isSpot = (value: number): value is Spot => value === 0 || value === 1 || value === 2

/** The spots a Mundo can move to from `from`: the same spot or one next to it. */
export function reachable(from: Spot): Spot[] {
  return [0, 1, 2].filter((spot): spot is Spot => isSpot(spot) && Math.abs(spot - from) <= 1)
}

/** A dodge to a spot too far away counts as staying put. */
export const dodgeTo = (from: Spot, move: number): Spot => (isSpot(move) && Math.abs(move - from) <= 1 ? move : from)

/** Who throws on each turn: the first player on even turns. */
export function throwerOf(turn: number, setup: GameSetup): Player {
  const first = firstPlayer(setup)
  return turn % 2 === 0 ? first : other(first)
}

export interface CleaverTurn {
  thrower: Player
  target: Spot
  /** Where the dodger stood before the turn, and where they went. */
  from: Spot
  to: Spot
  hit: boolean
}

/** Every finished turn, in order, stopping once the game is decided. */
export function cleaverTurns(moves: BothMoves, setup: GameSetup): CleaverTurn[] {
  const turns: CleaverTurn[] = []
  const spots: [Spot, Spot] = [START_SPOT, START_SPOT]
  for (let turn = 0; turn < MAX_TURNS[setup.variant]; turn++) {
    if (decided(turns)) break
    const thrower = throwerOf(turn, setup)
    const dodger = other(thrower)
    const thrown = moves[thrower][turn]
    const dodged = moves[dodger][turn]
    if (thrown === undefined || dodged === undefined) break
    const from = spots[dodger]
    const to = dodgeTo(from, dodged)
    const target: Spot = isSpot(thrown) ? thrown : START_SPOT
    spots[dodger] = to
    turns.push({ thrower, target, from, to, hit: target === to })
  }
  return turns
}

/** Where each Mundo stands after the turns played. */
export function spotsAfter(turns: readonly CleaverTurn[]): [Spot, Spot] {
  const spots: [Spot, Spot] = [START_SPOT, START_SPOT]
  for (const { thrower, to } of turns) spots[other(thrower)] = to
  return spots
}

/** Cleavers each player has landed. */
export function hitsLanded(turns: readonly CleaverTurn[]): [number, number] {
  const hits: [number, number] = [0, 0]
  for (const { thrower, hit } of turns) if (hit) hits[thrower] += 1
  return hits
}

function decided(turns: readonly CleaverTurn[]): boolean {
  return hitsLanded(turns).some((hits) => hits >= CLEAVER_HITS_TO_WIN)
}

function settle(moves: BothMoves, setup: GameSetup): Settled | null {
  const turns = cleaverTurns(moves, setup)
  const scores = hitsLanded(turns)
  if (!decided(turns) && turns.length < MAX_TURNS[setup.variant]) return null
  const winner: Player | null = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1
  return { winner, scores }
}

function owed(moves: BothMoves, setup: GameSetup): Owed[] {
  if (settle(moves, setup)) return []
  const turn = cleaverTurns(moves, setup).length
  return ([0, 1] as const).filter((player) => moves[player][turn] === undefined).map((player) => ({ player, step: turn }))
}

const randomSpot = (spots: readonly Spot[], random: RandomFn): Spot => spots[Math.floor(random() * spots.length)] ?? START_SPOT

/**
 * A move for a player who ran out of time: the dodger stays put, the thrower throws where the
 * dodger can't be if there is such a spot.
 */
function fallback({ player, step }: Owed, moves: BothMoves, setup: GameSetup): number {
  const spots = spotsAfter(cleaverTurns(moves, setup))
  if (throwerOf(step, setup) !== player) return spots[player]
  const dodgerSpot = spots[other(player)]
  const unreachable = ([0, 1, 2] as const).filter((spot) => !reachable(dodgerSpot).includes(spot))
  return randomSpot(unreachable.length > 0 ? unreachable : reachable(dodgerSpot), seededRandom(stepSeed(setup.seed, step, 61)))
}

/** The spot picked most often, if one stands out. */
export function favoriteSpot(spots: readonly Spot[]): Spot | null {
  const counts = [0, 1, 2].map((spot) => spots.filter((value) => value === spot).length)
  const most = Math.max(...counts)
  const favorites = counts.flatMap((count, spot) => (count === most && isSpot(spot) ? [spot] : []))
  return most > 0 && favorites.length === 1 ? (favorites[0] ?? null) : null
}

/** How often the bot plays your habits instead of picking at random. */
export const BOT_READS_YOU = 0.5

/** The bot throws where you like to dodge to, if you can get there; otherwise at random. */
export function botThrow(yourDodges: readonly Spot[], yourSpot: Spot, random: RandomFn): Spot {
  const options = reachable(yourSpot)
  const favorite = favoriteSpot(yourDodges)
  return favorite !== null && options.includes(favorite) && random() < BOT_READS_YOU ? favorite : randomSpot(options, random)
}

/** The bot dodges away from where you like to throw; otherwise it moves at random. */
export function botDodge(yourThrows: readonly Spot[], botSpot: Spot, random: RandomFn): Spot {
  const options = reachable(botSpot)
  const favorite = favoriteSpot(yourThrows)
  if (favorite !== null && random() < BOT_READS_YOU) {
    const away = options.filter((spot) => spot !== favorite)
    if (away.length > 0) return randomSpot(away, random)
  }
  return randomSpot(options, random)
}

/** The bot (player 1) chooses once the turns before are known, never by looking at your choice this turn. */
function botMove(step: number, moves: BothMoves, setup: GameSetup): number | undefined {
  if (step >= MAX_TURNS[setup.variant] || settle(moves, setup)) return undefined
  const turns = cleaverTurns(moves, setup)
  if (turns.length < step) return undefined
  const random = seededRandom(stepSeed(setup.seed, step, 67))
  const spots = spotsAfter(turns)
  if (throwerOf(step, setup) === 1) {
    const yourDodges = turns.filter(({ thrower }) => thrower === 1).map(({ to }) => to)
    return botThrow(yourDodges, spots[0], random)
  }
  const yourThrows = turns.filter(({ thrower }) => thrower === 0).map(({ target }) => target)
  return botDodge(yourThrows, spots[1], random)
}

export const CLEAVER_RULES: MiniGameRules = {
  chances: 1,
  // Each turn: the choice, plus about 2.5 s of banner and throw animation, with some slack.
  liveSeconds: () => MAX_TURNS.live * (TURN_SECONDS.live + 3) + 3,
  owed,
  settle,
  fallback,
  botMove,
  formatScore: (hits) => `${hits} ${hits === 1 ? 'hit' : 'hits'}`,
}
