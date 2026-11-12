import { describe, expect, it } from 'vitest'
import type { Role } from '../data/types'
import {
  canFinish,
  canRerollChampion,
  championRerollsLeft,
  currentRoundItems,
  nextShopRollSize,
  openItemSlots,
  rulesOf,
  canRoll,
  canStartNextItemRound,
  gameReducer,
  getTeamMembers,
  initialGameState,
  isItemMovable,
  type GameAction,
  type GameState,
} from './gameState'
import { MATCH_RULES, SHOP_ROLL_SIZE } from './rules'
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

  const apply = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state)

  function fullTeamState(): GameState {
    let state = initialGameState()
    for (const role of roles) {
      state = gameReducer(rollAndReveal(state, makeChampion({ id: role })), { type: 'place', role })
    }
    return state
  }

  /** Item phase, round 1, with the round's items revealed. */
  function roundOneState(): GameState {
    return apply(fullTeamState(), { type: 'startItems', items }, { type: 'revealItems' })
  }

  /** Gives item ids `from`..`from + 4` to one champion each. */
  const handOutRound = (state: GameState, from: number) =>
    apply(state, ...roles.map((role, i): GameAction => ({ type: 'assignItem', itemId: String(from + i), role })))

  it('only starts the item phase once the team is complete', () => {
    expect(gameReducer(initialGameState(), { type: 'startItems', items }).phase).toBe('draft')
    const started = gameReducer(fullTeamState(), { type: 'startItems', items })
    expect(started.phase).toBe('items')
    expect(started.itemRound).toBe(1)
  })

  it('cannot hand out items while they are still rolling', () => {
    const rolling = gameReducer(fullTeamState(), { type: 'startItems', items })
    expect(gameReducer(rolling, { type: 'assignItem', itemId: '0', role: 'TOP' })).toBe(rolling)
  })

  it('assigns, moves and unassigns items of the current round', () => {
    let state = gameReducer(roundOneState(), { type: 'assignItem', itemId: '0', role: 'TOP' })
    expect(state.assignments['0']).toBe('TOP')
    state = gameReducer(state, { type: 'assignItem', itemId: '0', role: 'MIDDLE' })
    expect(state.assignments['0']).toBe('MIDDLE')
    state = gameReducer(state, { type: 'unassignItem', itemId: '0' })
    expect(state.assignments['0']).toBeUndefined()
  })

  it('cannot hand out items from a later round', () => {
    const state = roundOneState()
    expect(gameReducer(state, { type: 'assignItem', itemId: '5', role: 'TOP' })).toBe(state)
  })

  it('rejects a third item on the same champion', () => {
    let state = handOutRound(roundOneState(), 0)
    state = apply(state, { type: 'nextItemRound' }, { type: 'revealItems' })
    state = gameReducer(state, { type: 'assignItem', itemId: '5', role: 'TOP' })
    expect(gameReducer(state, { type: 'assignItem', itemId: '6', role: 'TOP' })).toBe(state)
  })

  it('starts the next round only when the current round is handed out', () => {
    const partial = gameReducer(roundOneState(), { type: 'assignItem', itemId: '0', role: 'TOP' })
    expect(canStartNextItemRound(partial)).toBe(false)
    expect(gameReducer(partial, { type: 'nextItemRound' })).toBe(partial)

    const next = gameReducer(handOutRound(roundOneState(), 0), { type: 'nextItemRound' })
    expect(next.itemRound).toBe(2)
    expect(next.itemsRevealed).toBe(false)
  })

  it('locks the first round items once the next round starts', () => {
    const state = apply(handOutRound(roundOneState(), 0), { type: 'nextItemRound' }, { type: 'revealItems' })
    expect(isItemMovable(state, '0')).toBe(false)
    expect(isItemMovable(state, '5')).toBe(true)
    expect(gameReducer(state, { type: 'unassignItem', itemId: '0' })).toBe(state)
    expect(gameReducer(state, { type: 'assignItem', itemId: '0', role: 'JUNGLE' })).toBe(state)
  })

  it('finishes only after the last round, when every champion has two items', () => {
    const roundOne = handOutRound(roundOneState(), 0)
    expect(canFinish(roundOne)).toBe(false)
    expect(gameReducer(roundOne, { type: 'finish' }).phase).toBe('items')

    const roundTwo = handOutRound(apply(roundOne, { type: 'nextItemRound' }, { type: 'revealItems' }), 5)
    expect(canStartNextItemRound(roundTwo)).toBe(false)
    expect(gameReducer(roundTwo, { type: 'finish' }).phase).toBe('results')
  })
})

describe('getTeamMembers', () => {
  it('returns placed champions with their items in role order', () => {
    let state = gameReducer(rollAndReveal(initialGameState()), { type: 'place', role: 'MIDDLE' })
    state = { ...state, phase: 'items', items: [makeItem({ id: 'x' })], assignments: { x: 'MIDDLE' } }
    expect(getTeamMembers(state)).toEqual([{ role: 'MIDDLE', champion: ahri, items: [makeItem({ id: 'x' })] }])
  })
})

describe('Match vs Bots rules', () => {
  const roles: Role[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT']
  const apply = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state)
  const itemsFrom = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => makeItem({ id: `${prefix}${i}` }))

  function fullTeam(): GameState {
    let state = initialGameState(MATCH_RULES)
    for (const role of roles) state = gameReducer(rollAndReveal(state, makeChampion({ id: role })), { type: 'place', role })
    return state
  }

  describe('champion rerolls', () => {
    it('swaps a placed champion for a new one and uses up a reroll', () => {
      const state = gameReducer(fullTeam(), { type: 'rerollChampion', role: 'MIDDLE', champion: ahri })
      expect(state.team.MIDDLE?.id).toBe('Ahri')
      expect(championRerollsLeft(state)).toBe(MATCH_RULES.championRerolls - 1)
    })

    it('stops when the rerolls run out, and never works on an empty slot', () => {
      let state = fullTeam()
      for (let i = 0; i < MATCH_RULES.championRerolls; i++) {
        state = gameReducer(state, { type: 'rerollChampion', role: 'TOP', champion: makeChampion({ id: `New${i}` }) })
      }
      expect(canRerollChampion(state, 'TOP')).toBe(false)
      expect(canRerollChampion(initialGameState(MATCH_RULES), 'TOP')).toBe(false)
    })

    it('is not part of the Classic rules', () => {
      const classic = gameReducer(rollAndReveal(initialGameState()), { type: 'place', role: 'TOP' })
      expect(canRerollChampion(classic, 'TOP')).toBe(false)
    })
  })

  describe('shop rolls', () => {
    const shopOpen = () => apply(fullTeam(), { type: 'startItems', items: itemsFrom('a', SHOP_ROLL_SIZE) }, { type: 'revealItems' })

    it('lets the player keep any items and roll again; the rest are gone', () => {
      const state = apply(
        shopOpen(),
        { type: 'assignItem', itemId: 'a0', role: 'TOP' },
        { type: 'nextItemRound', items: itemsFrom('b', SHOP_ROLL_SIZE) },
        { type: 'revealItems' },
      )
      expect(currentRoundItems(state).map(({ id }) => id)).toEqual(['b0', 'b1', 'b2', 'b3', 'b4'])
      expect(isItemMovable(state, 'a0')).toBe(false)
      expect(isItemMovable(state, 'a1')).toBe(false)
      expect(getTeamMembers(state).find(({ role }) => role === 'TOP')?.items.map(({ id }) => id)).toEqual(['a0'])
      expect(openItemSlots(state)).toBe(9)
    })

    it('makes the final roll bring exactly the empty slots, which must all be used', () => {
      let state = apply(shopOpen(), { type: 'assignItem', itemId: 'a0', role: 'TOP' })
      state = apply(state, { type: 'nextItemRound', items: itemsFrom('b', nextShopRollSize(state)) }, { type: 'revealItems' })
      expect(nextShopRollSize(state)).toBe(9)
      state = apply(state, { type: 'nextItemRound', items: itemsFrom('c', 9) }, { type: 'revealItems' })
      expect(canStartNextItemRound(state)).toBe(false)
      expect(canFinish(state)).toBe(false)
      const slots: Role[] = ['TOP', 'JUNGLE', 'JUNGLE', 'MIDDLE', 'MIDDLE', 'BOTTOM', 'BOTTOM', 'SUPPORT', 'SUPPORT']
      state = apply(state, ...slots.map((role, i): GameAction => ({ type: 'assignItem', itemId: `c${i}`, role })))
      expect(canFinish(state)).toBe(true)
    })

    it('can finish early once every slot is filled', () => {
      let state = shopOpen()
      state = apply(state, ...roles.map((role, i): GameAction => ({ type: 'assignItem', itemId: `a${i}`, role })))
      state = apply(state, { type: 'nextItemRound', items: itemsFrom('b', SHOP_ROLL_SIZE) }, { type: 'revealItems' })
      state = apply(state, ...roles.map((role, i): GameAction => ({ type: 'assignItem', itemId: `b${i}`, role })))
      expect(canFinish(state)).toBe(true)
      expect(canStartNextItemRound(state)).toBe(false)
    })

    it('keeps the rules when starting over', () => {
      expect(rulesOf(gameReducer(fullTeam(), { type: 'reset' }))).toEqual(MATCH_RULES)
    })
  })
})
