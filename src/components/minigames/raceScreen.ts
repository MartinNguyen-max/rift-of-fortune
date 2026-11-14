import { RACE_SCORE, type RaceTrack, type RunOutcome } from '../../game/minigames/race'
import type { Tone } from './parts'

/** Meters shown on the lane: a little room behind the tower. */
const laneMeters = (track: RaceTrack) => track.tower + 7

/** Where a distance is drawn along the lane, 0–1: the start a little in, the tower near the end. */
export const laneShare = (track: RaceTrack, meters: number): number => 0.05 + (Math.min(meters, laneMeters(track)) / laneMeters(track)) * 0.88

export type RunCall = 'bullseye' | 'zone' | 'short' | 'long' | 'crash'

export function runCall(outcome: RunOutcome): RunCall {
  if (outcome.crashed) return 'crash'
  const distance = Math.abs(outcome.offset)
  if (distance <= RACE_SCORE.perfect) return 'bullseye'
  if (distance <= RACE_SCORE.zone) return 'zone'
  return outcome.offset < 0 ? 'short' : 'long'
}

export const RUN_CALLS: Record<RunCall, { text: string; tone: Tone }> = {
  bullseye: { text: 'BULLSEYE!', tone: 'win' },
  zone: { text: 'IN THE ZONE', tone: 'you' },
  short: { text: 'SHORT!', tone: 'plain' },
  long: { text: 'TOO FAR!', tone: 'plain' },
  crash: { text: 'CRASH!', tone: 'lose' },
}

/** "2.4 m short", "dead center", "hit the tower". */
export function describeStop(outcome: RunOutcome): string {
  if (outcome.crashed) return 'hit the tower'
  const distance = Math.abs(outcome.offset)
  if (distance < 0.1) return 'dead center'
  return `${distance.toFixed(1)} m ${outcome.offset < 0 ? 'short' : 'past'}`
}
