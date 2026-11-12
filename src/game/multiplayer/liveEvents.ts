import { pickRandom, seededRandom } from '../random'
import { LANES, opponent, type Lane, type LiveEventKind, type ScriptedEvent, type Side } from '../match/types'

const MINUTE = 60

/** Every multiplayer match has these four mini-games, in this order, at these game times. */
export const LIVE_EVENTS = [
  { kind: 'gank', time: 7 * MINUTE },
  { kind: 'teamfight', time: 16 * MINUTE },
  { kind: 'baron', time: 23 * MINUTE },
  { kind: 'elder', time: 31 * MINUTE },
] as const satisfies readonly { kind: LiveEventKind; time: number }[]

export const LIVE_EVENT_COUNT = LIVE_EVENTS.length

export const LIVE_EVENT_TITLES: Record<LiveEventKind, string> = {
  gank: 'Gank!',
  teamfight: 'Teamfight!',
  baron: 'Baron Nashor',
  elder: 'Elder Dragon',
}

/** A different random stream than the match itself, so the script never changes how a match plays. */
const SCRIPT_SALT = 0x9e3779b9

/** The live events of a match: who ganks and in which lane come from the match seed. */
export function liveScript(seed: number): ScriptedEvent[] {
  const random = seededRandom(seed ^ SCRIPT_SALT)
  const ganker: Side = random() < 0.5 ? 'blue' : 'red'
  const lane: Lane = pickRandom(LANES, random)
  return LIVE_EVENTS.map(({ kind, time }) => ({ kind, time, ganker, lane }))
}

/** The seed for one mini-game (Baron's hits, the ult bar), the same for both players. */
export function eventSeed(seed: number, eventIndex: number): number {
  return (seed ^ Math.imul(eventIndex + 1, 0x27d4eb2d)) >>> 0
}

/** A fair coin for a tie, the same for both players. */
export function tieBreaker(seed: number, eventIndex: number): Side {
  return seededRandom(seed ^ SCRIPT_SALT ^ ((eventIndex + 1) * 0x85ebca6b))() < 0.5 ? 'blue' : 'red'
}

/** Smite and ult duels: the higher score wins, a tie is a coin flip. */
export function duelWinner(scores: Record<Side, number>, seed: number, eventIndex: number): Side {
  if (scores.blue === scores.red) return tieBreaker(seed, eventIndex)
  return scores.blue > scores.red ? 'blue' : 'red'
}

/** The gank: the defender wins by guessing the bush the jungler hides in; otherwise the gank lands. */
export function gankWinner(ganker: Side, bush: Lane, guess: Lane | null): Side {
  return guess === bush ? opponent(ganker) : ganker
}

/** The gank's three bushes, one per lane. */
export const BUSH_NAMES: Record<Lane, string> = { top: 'Top', mid: 'Mid', bot: 'Bot' }
