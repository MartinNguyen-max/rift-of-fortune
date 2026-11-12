import { describe, expect, it } from 'vitest'
import { duelWinner, gankWinner, LIVE_EVENTS, liveScript, tieBreaker } from './liveEvents'

describe('liveScript', () => {
  it('has the four live events in game order', () => {
    const script = liveScript(5)
    expect(script.map(({ kind }) => kind)).toEqual(['gank', 'teamfight', 'baron', 'elder'])
    expect(script.map(({ time }) => time)).toEqual(LIVE_EVENTS.map(({ time }) => time))
  })

  it('is the same for both players, and picks either side as the ganker', () => {
    expect(liveScript(5)).toEqual(liveScript(5))
    const gankers = new Set(Array.from({ length: 40 }, (_, seed) => liveScript(seed)[0]?.ganker))
    expect(gankers).toEqual(new Set(['blue', 'red']))
  })
})

describe('duelWinner', () => {
  it('gives the duel to the higher score', () => {
    expect(duelWinner({ blue: 80, red: 79 }, 1, 0)).toBe('blue')
    expect(duelWinner({ blue: 0, red: 55 }, 1, 0)).toBe('red')
  })

  it('flips the same coin for both players on a tie', () => {
    expect(duelWinner({ blue: 70, red: 70 }, 9, 2)).toBe(tieBreaker(9, 2))
    const sides = new Set(Array.from({ length: 40 }, (_, seed) => tieBreaker(seed, 1)))
    expect(sides).toEqual(new Set(['blue', 'red']))
  })
})

describe('gankWinner', () => {
  it('gives the fight to the defender who guesses the right bush', () => {
    expect(gankWinner('blue', 'mid', 'mid')).toBe('red')
  })

  it('lets the gank land on a wrong guess or no guess', () => {
    expect(gankWinner('blue', 'mid', 'top')).toBe('blue')
    expect(gankWinner('red', 'bot', null)).toBe('red')
  })
})
