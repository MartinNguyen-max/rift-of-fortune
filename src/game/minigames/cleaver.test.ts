import { describe, expect, it } from 'vitest'
import { seededRandom } from '../random'
import {
  botDodge,
  botThrow,
  cleaverWinner,
  favoriteLane,
  hitsTaken,
  isHit,
  stepLane,
  throwerOfRound,
  type CleaverRound,
} from './cleaver'

const round = (thrower: 'player' | 'bot', throwLane: CleaverRound['throwLane'], dodgeLane: CleaverRound['dodgeLane']): CleaverRound => ({
  thrower,
  throwLane,
  dodgeLane,
})

describe('rounds', () => {
  it('lets the player throw first, then switches every round', () => {
    expect([0, 1, 2, 3].map(throwerOfRound)).toEqual(['player', 'bot', 'player', 'bot'])
  })

  it('hits when the cleaver goes down the dodger’s lane', () => {
    expect(isHit(round('player', 'top', 'top'))).toBe(true)
    expect(isHit(round('player', 'top', 'mid'))).toBe(false)
  })

  it('counts cleavers taken by the dodger', () => {
    expect(hitsTaken([round('player', 'top', 'top'), round('bot', 'mid', 'mid'), round('player', 'bot', 'top')])).toEqual({
      player: 1,
      bot: 1,
    })
  })

  it('ends when a Mundo has taken 3 cleavers', () => {
    const hit = round('player', 'mid', 'mid')
    expect(cleaverWinner([hit, hit])).toBeNull()
    expect(cleaverWinner([hit, hit, hit])).toBe('player')
    const taken = round('bot', 'top', 'top')
    expect(cleaverWinner([taken, taken, taken])).toBe('bot')
  })
})

describe('lanes', () => {
  it('moves one lane up or down, staying on the map', () => {
    expect(stepLane('mid', -1)).toBe('top')
    expect(stepLane('top', -1)).toBe('top')
    expect(stepLane('mid', 1)).toBe('bot')
    expect(stepLane('bot', 1)).toBe('bot')
  })

  it('finds a clear favorite lane', () => {
    expect(favoriteLane(['top', 'top', 'mid'])).toBe('top')
    expect(favoriteLane(['top', 'mid'])).toBeNull()
    expect(favoriteLane([])).toBeNull()
  })
})

describe('bot', () => {
  it('reads a player who always dodges to the same lane', () => {
    const random = seededRandom(3)
    const throws = Array.from({ length: 300 }, () => botThrow(['bot', 'bot', 'bot'], random))
    const share = throws.filter((lane) => lane === 'bot').length / throws.length
    expect(share).toBeGreaterThan(0.55)
  })

  it('avoids a player who always throws down the same lane', () => {
    const random = seededRandom(4)
    const dodges = Array.from({ length: 300 }, () => botDodge(['top', 'top'], random))
    const share = dodges.filter((lane) => lane === 'top').length / dodges.length
    expect(share).toBeLessThan(0.25)
  })
})
