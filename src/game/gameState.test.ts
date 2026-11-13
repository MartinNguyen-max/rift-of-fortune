import { describe, expect, it } from 'vitest'
import type { Role } from '../data/types'
import {
  canFinish,
  canRerollChampion,
  canRerollItem,
  isRerollStage,
  championRerollsLeft,
  itemRerollsLeft,
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
import { MATCH_RULES } from './rules'
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

describe('Match vs Bots rerolls', () => {
  const roles: Role[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT']
  const items = Array.from({ length: 10 }, (_, i) => makeItem({ id: String(i) }))
  const apply = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state)

  function teamOf(count: number): GameState {
    let state = initialGameState(MATCH_RULES)
    for (const role of roles.slice(0, count)) {
      state = gameReducer(rollAndReveal(state, makeChampion({ id: role })), { type: 'place', role })
    }
    return state
  }

  /** Both item rounds handed out, ready to be rated. */
  function equipped(): GameState {
    const handOut = (from: number) => roles.map((role, i): GameAction => ({ type: 'assignItem', itemId: String(from + i), role }))
    return apply(
      teamOf(5),
      { type: 'startItems', items },
      { type: 'revealItems' },
      ...handOut(0),
      { type: 'nextItemRound' },
      { type: 'revealItems' },
      ...handOut(5),
    )
  }

  it('opens champion rerolls only once all five champions are placed', () => {
    expect(canRerollChampion(teamOf(4), 'TOP')).toBe(false)
    expect(canRerollChampion(teamOf(5), 'TOP')).toBe(true)
  })

  it('swaps a champion for a new one and uses up a reroll, until none are left', () => {
    let state = gameReducer(teamOf(5), { type: 'rerollChampion', role: 'MIDDLE', champion: ahri })
    expect(state.team.MIDDLE?.id).toBe('Ahri')
    expect(championRerollsLeft(state)).toBe(MATCH_RULES.championRerolls - 1)
    for (let i = 1; i < MATCH_RULES.championRerolls; i++) {
      state = gameReducer(state, { type: 'rerollChampion', role: 'TOP', champion: makeChampion({ id: `New${i}` }) })
    }
    expect(canRerollChampion(state, 'TOP')).toBe(false)
  })

  it('opens item rerolls only once all ten items are equipped', () => {
    const halfway = apply(teamOf(5), { type: 'startItems', items }, { type: 'revealItems' })
    expect(canRerollItem(halfway, '0')).toBe(false)
    expect(canRerollItem(equipped(), '0')).toBe(true)
  })

  it('swaps an equipped item for a new one on the same champion', () => {
    const state = gameReducer(equipped(), { type: 'rerollItem', itemId: '0', item: makeItem({ id: 'New' }) })
    expect(getTeamMembers(state)[0]?.items.map(({ id }) => id)).toEqual(['New', '5'])
    expect(itemRerollsLeft(state)).toBe(MATCH_RULES.itemRerolls - 1)
    expect(canFinish(state)).toBe(true)
  })

  it('never rerolls into an item already in the game', () => {
    const state = gameReducer(equipped(), { type: 'rerollItem', itemId: '0', item: makeItem({ id: '7' }) })
    expect(itemRerollsLeft(state)).toBe(MATCH_RULES.itemRerolls)
  })

  it('has no rerolls in the Classic rules, and keeps the rules when starting over', () => {
    const classic = gameReducer(rollAndReveal(initialGameState()), { type: 'place', role: 'TOP' })
    expect(canRerollChampion(classic, 'TOP')).toBe(false)
    expect(rulesOf(gameReducer(teamOf(5), { type: 'reset' }))).toEqual(MATCH_RULES)
  })
})

describe('Match vs Bots: items lock for the reroll step', () => {
  const roles: Role[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT']
  const items = Array.from({ length: 10 }, (_, i) => makeItem({ id: String(i) }))
  const apply = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state)

  it('locks every item once all ten are placed, so they can only be rerolled', () => {
    let state = initialGameState(MATCH_RULES)
    for (const role of roles) state = gameReducer(rollAndReveal(state, makeChampion({ id: role })), { type: 'place', role })
    const handOut = (from: number) => roles.map((role, i): GameAction => ({ type: 'assignItem', itemId: String(from + i), role }))
    state = apply(state, { type: 'startItems', items }, { type: 'revealItems' }, ...handOut(0), { type: 'nextItemRound' }, { type: 'revealItems' })
    state = apply(state, ...handOut(5).slice(0, 4))
    expect(isItemMovable(state, '5')).toBe(true)
    state = apply(state, ...handOut(5).slice(4))
    expect(isRerollStage(state)).toBe(true)
    expect(isItemMovable(state, '9')).toBe(false)
    expect(apply(state, { type: 'unassignItem', itemId: '9' }).assignments['9']).toBe('SUPPORT')
    expect(canRerollItem(state, '9')).toBe(true)
  })
})

describe('gameReducer: fast pace', () => {
  const fast = { championRerolls: 3, itemRerolls: 3, pace: 'fast' as const }
  const roles: Role[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT']
  const offer = roles.map((role) => makeChampion({ id: `Champ${role}` }))
  const items = Array.from({ length: 10 }, (_, index) => makeItem({ id: `${index}` }))

  function placeAll(state: GameState): GameState {
    return roles.reduce(
      (current, role, index) => gameReducer(current, { type: 'placeOffered', championId: offer[index]?.id ?? '', role }),
      state,
    )
  }

  it('offers five champions at once and never rolls', () => {
    const state = initialGameState(fast, offer)
    expect(state.offer).toHaveLength(5)
    expect(canRoll(state)).toBe(false)
    expect(initialGameState(MATCH_RULES).offer).toBeUndefined()
  })

  it('places an offered champion in any empty role, once', () => {
    const state = initialGameState(fast, offer)
    const placed = gameReducer(state, { type: 'placeOffered', championId: 'ChampTOP', role: 'SUPPORT' })
    expect(placed.team.SUPPORT?.id).toBe('ChampTOP')
    expect(placed.offer).toHaveLength(4)
    expect(gameReducer(placed, { type: 'placeOffered', championId: 'ChampJUNGLE', role: 'SUPPORT' })).toBe(placed)
    expect(gameReducer(placed, { type: 'placeOffered', championId: 'ChampTOP', role: 'TOP' })).toBe(placed)
  })

  it('hands out all ten items at once, revealed, in one round', () => {
    const drafted = placeAll(initialGameState(fast, offer))
    const started = gameReducer(drafted, { type: 'startItems', items })
    expect(started.itemsRevealed).toBe(true)
    let state = started
    items.forEach((item, index) => {
      state = gameReducer(state, { type: 'assignItem', itemId: item.id, role: roles[Math.floor(index / 2)] ?? 'TOP' })
    })
    expect(canStartNextItemRound(state)).toBe(false)
    expect(canFinish(state)).toBe(true)
  })

  it('offers new champions on reset', () => {
    const placed = placeAll(initialGameState(fast, offer))
    const fresh = gameReducer(placed, { type: 'reset', offer: offer.slice(0, 5) })
    expect(fresh.offer).toHaveLength(5)
    expect(fresh.team.TOP).toBeNull()
  })
})
