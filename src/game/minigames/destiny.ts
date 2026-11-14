import { seededRandom } from '../random'
import { isLane, LANES, randomLane, type Lane } from './riftLanes'
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
} from './versus'

/**
 * Destiny: Twisted Fate shows a card over one lane, then Gates to a lane: the card's lane (honest)
 * or another one (a bluff). The guard sees the card and picks one lane to guard.
 * - Guarded (the guard is in his lane): +1 for the guard.
 * - Landed free on the card's lane: +2 for Twisted Fate. He told you, and you didn't believe him.
 * - Landed free after a bluff: +1 for Twisted Fate.
 * So the card is worth reading, but never safe to trust: a mind game, not a coin flip.
 */
export const DESTINY_POINTS = { honest: 2, bluff: 1, guarded: 1 } as const

/** A guard who ran out of time guards nothing. */
export const NO_GUARD = 3

/** Seconds for each choice: Twisted Fate picks twice (the card, then the Gate), the guard once. */
export const DESTINY_SECONDS = { gate: { solo: 8, live: 10 }, guard: { solo: 6, live: 8 } } as const

/** Solo plays three rounds as each. Multiplayer plays one, or one each with both roles. */
export const DESTINY_SOLO_HALVES = 6

export const destinyHalves = (setup: GameSetup): number =>
  setup.variant === 'solo' ? DESTINY_SOLO_HALVES : setup.bothRoles ? 2 : 1

/** Who plays Twisted Fate in each half: the first player in even halves, the other one in odd halves. */
export function gaterOf(half: number, setup: GameSetup): Player {
  const first = firstPlayer(setup)
  return half % 2 === 0 ? first : other(first)
}

// ── Twisted Fate's move: the card's lane and the Gate's lane, in one number ─────────

export interface Gate {
  /** The lane the card was shown over. */
  card: Lane
  /** The lane he Gated to. */
  lane: Lane
}

export const gateMove = ({ card, lane }: Gate): number => card * 3 + lane

/** A Gate move; anything malformed is an honest Gate to mid. */
export function readGate(move: number): Gate {
  const card = Math.floor(move / 3)
  const lane = move % 3
  return isLane(card) && isLane(lane) ? { card, lane } : { card: 1, lane: 1 }
}

/** Out of time: the card and the Gate both go mid, the most obvious play there is. */
export const TIMEOUT_GATE = gateMove({ card: 1, lane: 1 })

// ── Results ─────────

export interface DestinyHalf {
  gater: Player
  card: Lane
  lane: Lane
  /** The guarded lane, or null for no guard. */
  guard: Lane | null
  guarded: boolean
  honest: boolean
}

/** Every finished half, in order. */
export function destinyResults(moves: BothMoves, setup: GameSetup): DestinyHalf[] {
  const results: DestinyHalf[] = []
  for (let half = 0; half < destinyHalves(setup); half++) {
    const gater = gaterOf(half, setup)
    const gated = moves[gater][half]
    const guarded = moves[other(gater)][half]
    if (gated === undefined || guarded === undefined) break
    const { card, lane } = readGate(gated)
    const guard = isLane(guarded) ? guarded : null
    results.push({ gater, card, lane, guard, guarded: guard === lane, honest: card === lane })
  }
  return results
}

/** Who scores a half and how much. */
export function halfScore({ gater, guarded, honest }: DestinyHalf): { scorer: Player; points: number } {
  if (guarded) return { scorer: other(gater), points: DESTINY_POINTS.guarded }
  return { scorer: gater, points: honest ? DESTINY_POINTS.honest : DESTINY_POINTS.bluff }
}

/** Points so far, by player. */
export function destinyPoints(results: readonly DestinyHalf[]): [number, number] {
  const points: [number, number] = [0, 0]
  for (const result of results) {
    const { scorer, points: earned } = halfScore(result)
    points[scorer] += earned
  }
  return points
}

function settle(moves: BothMoves, setup: GameSetup): Settled | null {
  const results = destinyResults(moves, setup)
  if (results.length < destinyHalves(setup)) return null
  const scores = destinyPoints(results)
  const winner: Player | null = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1
  return { winner, scores }
}

function owed(moves: BothMoves, setup: GameSetup): Owed[] {
  const half = destinyResults(moves, setup).length
  if (half >= destinyHalves(setup)) return []
  const gater = gaterOf(half, setup)
  // The guard can only guard once the card is shown.
  if (moves[gater][half] === undefined) return [{ player: gater, step: half }]
  return [{ player: other(gater), step: half }]
}

// ── The bot: Ahri ─────────

/**
 * Ahri, the bot. As Twisted Fate she Gates to her card's lane about a third of the time. As the
 * guard she reads you: the more often you Gated to your card's lane before, the more she guards
 * it (a quarter of the time if you always bluffed, most of the time if you never did).
 */
export const BOT_DESTINY = { honest: 0.33, guardCard: { unread: 0.5, never: 0.25, always: 0.85 } } as const

/** How likely the bot guards the card's lane, after seeing your earlier Gates. */
export function guardCardChance(yourGates: readonly DestinyHalf[]): number {
  const { unread, never, always } = BOT_DESTINY.guardCard
  if (yourGates.length === 0) return unread
  const honestShare = yourGates.filter(({ honest }) => honest).length / yourGates.length
  return never + (always - never) * honestShare
}

function botMove(step: number, moves: BothMoves, setup: GameSetup): number | undefined {
  if (step >= destinyHalves(setup)) return undefined
  const random = seededRandom(stepSeed(setup.seed, step, 83))
  if (gaterOf(step, setup) === 1) {
    const card = randomLane(random)
    const otherLanes = LANES.filter((lane) => lane !== card)
    const lane = random() < BOT_DESTINY.honest ? card : (otherLanes[Math.floor(random() * otherLanes.length)] ?? card)
    return gateMove({ card, lane })
  }
  // The bot guards once your card is shown, reading only your earlier Gates.
  const yours = moves[0][step]
  if (yours === undefined) return undefined
  const { card } = readGate(yours)
  const earlier = destinyResults(moves, setup).filter(({ gater }) => gater === 0)
  if (random() < guardCardChance(earlier)) return card
  const otherLanes = LANES.filter((lane) => lane !== card)
  return otherLanes[Math.floor(random() * otherLanes.length)] ?? card
}

export const DESTINY_RULES: MiniGameRules = {
  chances: 2,
  liveSeconds: (setup) => destinyHalves(setup) * (DESTINY_SECONDS.gate.live + DESTINY_SECONDS.guard.live + 5),
  owed,
  settle,
  // Twisted Fate out of time Gates mid under his own card; a guard out of time guards nothing.
  fallback: ({ player, step }, _moves, setup) => (gaterOf(step, setup) === player ? TIMEOUT_GATE : NO_GUARD),
  botMove,
  formatScore: (points) => `${points} ${points === 1 ? 'point' : 'points'}`,
}
