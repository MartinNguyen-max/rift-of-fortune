import { holdDistance, holdSpeed, NO_RUN, RACE, RACE_SCORE, type RaceTrack, type RunOutcome } from '../../game/minigames/race'
import type { Tone } from './parts'

/** Meters shown on the lane: a little room behind the tower. */
const laneMeters = (track: RaceTrack) => track.tower + 7

/** Where a distance is drawn along the lane, 0–1: the start a little in, the tower near the end. */
export const laneShare = (track: RaceTrack, meters: number): number => 0.05 + (Math.min(meters, laneMeters(track)) / laneMeters(track)) * 0.88

export interface SlideFrame {
  position: number
  speed: number
}

/** Sion `seconds` after letting go of a hold: still sliding, or stopped (at the tower for a crash). */
export function slideAt(track: RaceTrack, holdSeconds: number, seconds: number): SlideFrame {
  const startSpeed = holdSpeed(track, holdSeconds)
  const slideSeconds = startSpeed / RACE.brake
  const time = Math.min(seconds, slideSeconds)
  const position = Math.min(track.tower, holdDistance(track, holdSeconds) + startSpeed * time - (RACE.brake * time * time) / 2)
  return { position, speed: position >= track.tower ? 0 : Math.max(0, startSpeed - RACE.brake * time) }
}

/** How long the slide after a hold lasts: until Sion stops, or until he hits the tower. */
export function slideDuration(track: RaceTrack, holdSeconds: number): number {
  const startSpeed = holdSpeed(track, holdSeconds)
  const room = track.tower - holdDistance(track, holdSeconds)
  if (room <= 0) return 0
  const discriminant = startSpeed * startSpeed - 2 * RACE.brake * room
  return discriminant < 0 ? startSpeed / RACE.brake : (startSpeed - Math.sqrt(discriminant)) / RACE.brake
}

export type RunCall = 'bullseye' | 'zone' | 'short' | 'long' | 'crash' | 'none'

export function runCall(outcome: RunOutcome, holdMs: number): RunCall {
  if (holdMs === NO_RUN) return 'none'
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
  none: { text: 'NO CHARGE', tone: 'lose' },
}

/** "2.4 m short", "dead center", "hit the tower". */
export function describeStop(outcome: RunOutcome): string {
  if (outcome.crashed) return 'hit the tower'
  const distance = Math.abs(outcome.offset)
  if (distance < 0.1) return 'dead center'
  return `${distance.toFixed(1)} m ${outcome.offset < 0 ? 'short' : 'past'}`
}
