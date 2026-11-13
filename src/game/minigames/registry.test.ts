import { describe, expect, it } from 'vitest'
import { MINI_GAME_IDS } from './catalog'
import { MINI_GAME_RULES } from './registry'
import { botMoves, soloSetup, withMove, type BothMoves, type GameSetup, type Moves } from './versus'

const setups: GameSetup[] = [
  soloSetup(11),
  { seed: 11, variant: 'live', bothRoles: false, late: false },
  { seed: 12, variant: 'live', bothRoles: true, late: true },
]

describe.each(MINI_GAME_IDS)('%s', (id) => {
  const rules = MINI_GAME_RULES[id]

  it.each(setups)('always settles when owed moves are filled in ($variant, both roles: $bothRoles)', (setup) => {
    let moves: BothMoves = [[], []]
    for (let tick = 0; tick < 100 && !rules.settle(moves, setup); tick++) {
      const owed = rules.owed(moves, setup)
      expect(owed.length).toBeGreaterThan(0)
      for (const debt of owed) {
        const value = rules.fallback(debt, moves, setup)
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        const next: [Moves, Moves] = [moves[0], moves[1]]
        next[debt.player] = withMove(moves[debt.player], debt.step, value)
        moves = next
      }
    }
    const settled = rules.settle(moves, setup)
    expect(settled).not.toBeNull()
    expect(rules.owed(moves, setup)).toEqual([])
  })

  it('finishes against the bot when you play the poor move every time', () => {
    const setup = soloSetup(21)
    let mine: Moves = []
    for (let tick = 0; tick < 100; tick++) {
      const moves: BothMoves = [mine, botMoves(rules, mine, setup)]
      if (rules.settle(moves, setup)) break
      const debt = rules.owed(moves, setup).find(({ player }) => player === 0)
      expect(debt).toBeDefined()
      if (debt) mine = withMove(mine, debt.step, rules.fallback(debt, moves, setup))
    }
    expect(rules.settle([mine, botMoves(rules, mine, setup)], setup)).not.toBeNull()
  })
})
