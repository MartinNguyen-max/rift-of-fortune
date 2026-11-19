import { describe, expect, it } from 'vitest'
import { teamFightWinner } from './teamFight'

describe('team fight winner', () => {
  it('gives the win to the higher team rating, whatever the seed', () => {
    for (const seed of [1, 2, 3, 42]) {
      expect(teamFightWinner({ blue: 71, red: 70 }, seed)).toEqual({ winner: 'blue', coinFlip: false })
      expect(teamFightWinner({ blue: 40, red: 88 }, seed)).toEqual({ winner: 'red', coinFlip: false })
    }
  })

  it('flips a coin on equal ratings, the same for the same seed', () => {
    const result = teamFightWinner({ blue: 60, red: 60 }, 9)
    expect(result.coinFlip).toBe(true)
    expect(teamFightWinner({ blue: 60, red: 60 }, 9)).toEqual(result)
  })

  it('lets both sides win a coin flip', () => {
    const winners = new Set(Array.from({ length: 40 }, (_, seed) => teamFightWinner({ blue: 50, red: 50 }, seed).winner))
    expect(winners).toEqual(new Set(['blue', 'red']))
  })
})
