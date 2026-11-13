import { LIVE_EVENT_GOLD_TOTAL } from '../match/config'
import { LANES, type LiveEventKind, type ScriptedEvent, type Side } from '../match/types'
import type { MiniGameId } from '../minigames/catalog'
import { firstPlayer, type GameSetup } from '../minigames/versus'
import { pickRandom, seededRandom } from '../random'

const MINUTE = 60

/** Live events are spread over this part of the match. */
export const LIVE_WINDOW = { first: 7 * MINUTE, last: 31 * MINUTE } as const
/** Baron is up from 20:00, so a smite event never comes earlier. */
export const SMITE_FROM = 20 * MINUTE
/** A smite event this late fights Elder instead of Baron half the time. */
export const ELDER_FROM = 28 * MINUTE

/** One mini-game played as a live event in the match. */
export interface LiveEvent extends ScriptedEvent {
  game: MiniGameId
  /** The smite game fights Elder instead of Baron. */
  late: boolean
}

/** A different random stream than the match itself, so the script never changes how a match plays. */
const SCRIPT_SALT = 0x9e3779b9

/** Ganks happen early, objectives late: the gank game goes first, the smite game last. */
const ORDER: Partial<Record<MiniGameId, number>> = { gank: -1, smite: 1 }

export function orderLiveGames(games: readonly MiniGameId[]): MiniGameId[] {
  return games.toSorted((a, b) => (ORDER[a] ?? 0) - (ORDER[b] ?? 0))
}

/** Game times of `count` events, evenly spread from 7:00 to 31:00 (a single one at 19:00). */
export function eventTimes(count: number): number[] {
  if (count <= 1) return count === 1 ? [(LIVE_WINDOW.first + LIVE_WINDOW.last) / 2] : []
  const gap = (LIVE_WINDOW.last - LIVE_WINDOW.first) / (count - 1)
  return Array.from({ length: count }, (_, index) => Math.round(LIVE_WINDOW.first + gap * index))
}

/** What a mini-game's winner gets in the match: the gank, Baron or Elder, or a teamfight. */
export function matchEventOf(game: MiniGameId, late: boolean): LiveEventKind {
  if (game === 'gank') return 'gank'
  if (game === 'smite') return late ? 'elder' : 'baron'
  return 'teamfight'
}

/** The seed for one mini-game, the same for both players. */
export function eventSeed(seed: number, eventIndex: number): number {
  return (seed ^ Math.imul(eventIndex + 1, 0x27d4eb2d)) >>> 0
}

/** The side of a mini-game player: player 0 is the host, on blue. */
export const sideOfPlayer = (player: 0 | 1): Side => (player === 0 ? 'blue' : 'red')

/** A mini-game's setup in a match. */
export function eventSetup(seed: number, eventIndex: number, late: boolean, bothRoles: boolean): GameSetup {
  return { seed: eventSeed(seed, eventIndex), variant: 'live', bothRoles, late }
}

/**
 * The live events of a match from the chosen mini-games: in game order, at fixed times, each worth
 * the same share of the event gold, so 3 or 5 events weigh the same in total. The gank lane and
 * the coin for Elder come from the match seed; the ganker is whoever hides first in the gank game.
 */
export function liveEvents(seed: number, games: readonly MiniGameId[]): LiveEvent[] {
  const ordered = orderLiveGames(games)
  const times = eventTimes(ordered.length)
  const random = seededRandom(seed ^ SCRIPT_SALT)
  const lane = pickRandom(LANES, random)
  const elderCoin = random() < 0.5
  const gold = ordered.length > 0 ? Math.round(LIVE_EVENT_GOLD_TOTAL / ordered.length) : 0
  return ordered.map((game, index) => {
    const spread = times[index] ?? LIVE_WINDOW.last
    const time = game === 'smite' ? Math.max(spread, SMITE_FROM) : spread
    const late = game === 'smite' && time >= ELDER_FROM && elderCoin
    const ganker = sideOfPlayer(firstPlayer(eventSetup(seed, index, late, false)))
    return { kind: matchEventOf(game, late), time, ganker, lane, gold, game, late }
  })
}

/** A fair coin for a tie, the same for both players. */
export function tieBreaker(seed: number, eventIndex: number): Side {
  return seededRandom(seed ^ SCRIPT_SALT ^ ((eventIndex + 1) * 0x85ebca6b))() < 0.5 ? 'blue' : 'red'
}

/** The winning side of a mini-game: its winner, or the coin for a tie. */
export function eventWinner(winner: 0 | 1 | null, seed: number, eventIndex: number): Side {
  return winner === null ? tieBreaker(seed, eventIndex) : sideOfPlayer(winner)
}
