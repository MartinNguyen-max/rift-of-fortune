import { describe, expect, it } from 'vitest'
import type { Role } from '../data/types'
import { canRoll, gameReducer, getTeamMembers, initialGameState, type GameState } from './gameState'
import { makeChampion, makeItem } from './testUtils'

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

describe('gameReducer: items', () => {
  const roles: Role[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT']
  const items = Array.from({ length: 10 }, (_, i) => makeItem({ id: String(i) }))

  function fullTeamState(): GameState {
    let state = initialGameState()
    for (const role of roles) {
      state = gameReducer(rollAndReveal(state, makeChampion({ id: role })), { type: 'place', role })
    }
    return state
  }

  it('only starts the item phase once the team is complete', () => {
    expect(gameReducer(initialGameState(), { type: 'startItems', items }).phase).toBe('draft')
    expect(gameReducer(fullTeamState(), { type: 'startItems', items }).phase).toBe('items')
  })

  it('assigns, moves and unassigns items', () => {
    let state = gameReducer(fullTeamState(), { type: 'startItems', items })
    state = gameReducer(state, { type: 'assignItem', itemId: '0', role: 'TOP' })
    expect(state.assignments['0']).toBe('TOP')
    state = gameReducer(state, { type: 'assignItem', itemId: '0', role: 'MIDDLE' })
    expect(state.assignments['0']).toBe('MIDDLE')
    state = gameReducer(state, { type: 'unassignItem', itemId: '0' })
    expect(state.assignments['0']).toBeUndefined()
  })

  it('rejects a third item on the same champion', () => {
    let state = gameReducer(fullTeamState(), { type: 'startItems', items })
    state = gameReducer(state, { type: 'assignItem', itemId: '0', role: 'TOP' })
    state = gameReducer(state, { type: 'assignItem', itemId: '1', role: 'TOP' })
    expect(gameReducer(state, { type: 'assignItem', itemId: '2', role: 'TOP' })).toBe(state)
  })

  it('finishes only when every champion has exactly two items', () => {
    let state = gameReducer(fullTeamState(), { type: 'startItems', items })
    expect(gameReducer(state, { type: 'finish' }).phase).toBe('items')
    items.forEach((item, index) => {
      state = gameReducer(state, { type: 'assignItem', itemId: item.id, role: roles[Math.floor(index / 2)] ?? 'TOP' })
    })
    expect(gameReducer(state, { type: 'finish' }).phase).toBe('results')
  })
})

describe('getTeamMembers', () => {
  it('returns placed champions with their items in role order', () => {
    let state = gameReducer(rollAndReveal(initialGameState()), { type: 'place', role: 'MIDDLE' })
    state = { ...state, phase: 'items', items: [makeItem({ id: 'x' })], assignments: { x: 'MIDDLE' } }
    expect(getTeamMembers(state)).toEqual([{ role: 'MIDDLE', champion: ahri, items: [makeItem({ id: 'x' })] }])
  })
})
