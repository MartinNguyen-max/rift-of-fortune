import { describe, expect, it } from 'vitest'
import { LIVE_EVENT_GOLD_TOTAL } from '../match/config'
import { MINI_GAME_IDS } from '../minigames/catalog'
import {
  ELDER_FROM,
  eventTimes,
  eventWinner,
  LIVE_WINDOW,
  liveEvents,
  matchEventOf,
  orderLiveGames,
  SMITE_FROM,
  tieBreaker,
} from './liveEvents'

describe('orderLiveGames', () => {
  it('puts the gank first and the smite last, the rest in the chosen order', () => {
    expect(orderLiveGames(['hook', 'smite', 'duel', 'gank', 'combo'])).toEqual(['gank', 'hook', 'duel', 'combo', 'smite'])
  })
})

describe('eventTimes', () => {
  it('spreads events evenly from 7:00 to 31:00', () => {
    expect(eventTimes(3)).toEqual([7 * 60, 19 * 60, 31 * 60])
    expect(eventTimes(5)).toEqual([7 * 60, 13 * 60, 19 * 60, 25 * 60, 31 * 60])
    expect(eventTimes(1)).toEqual([19 * 60])
    expect(eventTimes(0)).toEqual([])
  })
})

describe('liveEvents', () => {
  it('maps each game to its match event: gank, Baron or Elder, or a teamfight', () => {
    expect(matchEventOf('gank', false)).toBe('gank')
    expect(matchEventOf('smite', false)).toBe('baron')
    expect(matchEventOf('smite', true)).toBe('elder')
    expect(matchEventOf('hook', false)).toBe('teamfight')
  })

  it('is the same for both players and stays in time order', () => {
    expect(liveEvents(5, ['smite', 'duel', 'gank'])).toEqual(liveEvents(5, ['smite', 'duel', 'gank']))
    for (let seed = 0; seed < 50; seed++) {
      const times = liveEvents(seed, [...MINI_GAME_IDS]).map(({ time }) => time)
      expect(times).toEqual(times.toSorted((a, b) => a - b))
      expect(times[0]).toBe(LIVE_WINDOW.first)
    }
  })

  it('splits the same event gold over 3 or 5 events', () => {
    const total = (games: Parameters<typeof liveEvents>[1]) => liveEvents(1, games).reduce((sum, { gold }) => sum + gold, 0)
    expect(total(['duel', 'hook', 'combo'])).toBe(LIVE_EVENT_GOLD_TOTAL)
    expect(total(['duel', 'hook', 'combo', 'forge', 'ult'])).toBe(LIVE_EVENT_GOLD_TOTAL)
  })

  it('never plays the smite before Baron is up, and fights Elder only late', () => {
    for (let seed = 0; seed < 60; seed++) {
      for (const games of [['smite'], ['smite', 'duel', 'hook']] as const) {
        const smite = liveEvents(seed, games).find(({ game }) => game === 'smite')
        expect(smite?.time).toBeGreaterThanOrEqual(SMITE_FROM)
        if (smite?.late) expect(smite.time).toBeGreaterThanOrEqual(ELDER_FROM)
        expect(smite?.kind).toBe(smite?.late ? 'elder' : 'baron')
      }
    }
    const kinds = new Set(Array.from({ length: 40 }, (_, seed) => liveEvents(seed, ['duel', 'smite'])[1]?.kind))
    expect(kinds).toEqual(new Set(['baron', 'elder']))
  })

  it('picks either side as the ganker', () => {
    const gankers = new Set(Array.from({ length: 40 }, (_, seed) => liveEvents(seed, ['gank'])[0]?.ganker))
    expect(gankers).toEqual(new Set(['blue', 'red']))
  })
})

describe('eventWinner', () => {
  it('gives the event to the mini-game winner: the host is blue', () => {
    expect(eventWinner(0, 1, 0)).toBe('blue')
    expect(eventWinner(1, 1, 0)).toBe('red')
  })

  it('flips the same coin for both players on a tie', () => {
    expect(eventWinner(null, 9, 2)).toBe(tieBreaker(9, 2))
    const sides = new Set(Array.from({ length: 40 }, (_, seed) => tieBreaker(seed, 1)))
    expect(sides).toEqual(new Set(['blue', 'red']))
  })
})
