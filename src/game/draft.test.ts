import { describe, expect, it } from 'vitest'
import { rollChampion } from './draft'
import { emptyTeam } from './team'
import { makeChampion } from './testUtils'

describe('rollChampion', () => {
  const ahri = makeChampion({ id: 'Ahri' })
  const garen = makeChampion({ id: 'Garen' })

  it('never rolls a champion that is already on the team', () => {
    const team = { ...emptyTeam(), MIDDLE: ahri }
    for (const value of [0, 0.5, 0.99]) {
      expect(rollChampion([ahri, garen], team, () => value)).toBe(garen)
    }
  })
})
