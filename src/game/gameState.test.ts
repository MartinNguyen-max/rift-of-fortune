import { describe, expect, it } from 'vitest'
import type { Role } from '../data/types'
import { canRoll, gameReducer, initialGameState, type GameState } from './gameState'
import { makeChampion } from './testUtils'

const ahri = makeChampion({ id: 'Ahri' })

function rollAndReveal(state: GameState, champion = ahri): GameState {
  return gameReducer(gameReducer(state, { type: 'roll', champion }), { type: 'reveal' })
}

describe('gameReducer: draft', () => {
  it('cannot place a champion before the roll is revealed', () => {
    const rolled = gameReducer(initialGameState(), { type: 'roll', champion: ahri })
    expect(gameReducer(rolled, { type: 'place', role: 'MIDDLE' })).toBe(rolled)
  })

  it('places the revealed champion and locks the slot', () => {
    const placed = gameReducer(rollAndReveal(initialGameState()), { type: 'place', role: 'MIDDLE' })
    expect(placed.team.MIDDLE).toBe(ahri)
    expect(placed.rolled).toBeNull()

    const again = rollAndReveal(placed, makeChampion({ id: 'Garen' }))
    expect(gameReducer(again, { type: 'place', role: 'MIDDLE' })).toBe(again)
  })

  it('does not allow a second roll while a champion is waiting', () => {
    const rolled = gameReducer(initialGameState(), { type: 'roll', champion: ahri })
    expect(canRoll(rolled)).toBe(false)
    expect(gameReducer(rolled, { type: 'roll', champion: makeChampion({ id: 'Garen' }) })).toBe(rolled)
  })

  it('stops rolling once all five slots are filled', () => {
    let state = initialGameState()
    const roles: Role[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT']
    for (const role of roles) {
      state = gameReducer(rollAndReveal(state, makeChampion({ id: role })), { type: 'place', role })
    }
    expect(canRoll(state)).toBe(false)
  })

  it('resets to an empty draft', () => {
    const placed = gameReducer(rollAndReveal(initialGameState()), { type: 'place', role: 'TOP' })
    expect(gameReducer(placed, { type: 'reset' })).toEqual(initialGameState())
  })
})
