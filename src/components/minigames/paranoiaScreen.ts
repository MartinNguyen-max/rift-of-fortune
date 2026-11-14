import { flickersMs, flightStartMs, type Flight } from '../../game/minigames/paranoia'

export type ParanoiaPhase = 'dark' | 'flight' | 'call'

export interface ParanoiaView {
  phase: ParanoiaPhase
  /** The flicker showing Nocturne right now, if any. */
  flicker: number | null
}

/** What a round shows `ms` after it started: the lights going out, the flickers, then the call. */
export function paranoiaView(flight: Flight, step: number, ms: number): ParanoiaView {
  const start = flightStartMs(step)
  if (ms < start) return { phase: 'dark', flicker: null }
  const into = ms - start
  if (into >= flickersMs(flight)) return { phase: 'call', flicker: null }
  const index = Math.floor(into / flight.gapMs)
  const showing = into - index * flight.gapMs < flight.flickerMs && index < flight.flickers.length
  return { phase: 'flight', flicker: showing ? index : null }
}
