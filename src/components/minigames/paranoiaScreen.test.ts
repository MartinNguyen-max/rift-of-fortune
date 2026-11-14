import { describe, expect, it } from 'vitest'
import { flightStartMs, paranoiaFlight } from '../../game/minigames/paranoia'
import { paranoiaView } from './paranoiaScreen'

describe('paranoiaView', () => {
  const flight = paranoiaFlight(12, 1)
  const start = flightStartMs(1)

  it('starts dark, then shows each flicker only for its moment, then opens the call', () => {
    expect(paranoiaView(flight, 1, 0)).toEqual({ phase: 'dark', flicker: null })
    expect(paranoiaView(flight, 1, start + 1)).toEqual({ phase: 'flight', flicker: 0 })
    expect(paranoiaView(flight, 1, start + flight.flickerMs + 5)).toEqual({ phase: 'flight', flicker: null })
    expect(paranoiaView(flight, 1, start + flight.gapMs + 1)).toEqual({ phase: 'flight', flicker: 1 })
    const last = flight.flickers.length - 1
    expect(paranoiaView(flight, 1, start + last * flight.gapMs + 1).flicker).toBe(last)
    expect(paranoiaView(flight, 1, start + last * flight.gapMs + flight.flickerMs)).toEqual({ phase: 'call', flicker: null })
  })

  it('waits longer in the dark before the first round', () => {
    expect(paranoiaView(flight, 0, flightStartMs(1) + 1).phase).toBe('dark')
  })
})
