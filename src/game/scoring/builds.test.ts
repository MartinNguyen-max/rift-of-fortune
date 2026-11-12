import { describe, expect, it } from 'vitest'
import { gameData } from '../../data'
import { makeChampion } from '../testUtils'
import { BUILD_PROFILES, buildProfiles, CHAMPION_BUILDS, guessBuildProfiles, ITEM_BUYERS } from './builds'

describe('build table', () => {
  it('knows who buys every item in the current data', () => {
    const unknown = gameData.items.filter(({ id }) => !ITEM_BUYERS[id]).map(({ name }) => name)
    expect(unknown).toEqual([])
  })

  it('knows how almost every champion builds (new releases fall back to their class)', () => {
    const unknown = gameData.champions.filter(({ id }) => !CHAMPION_BUILDS[id])
    expect(unknown.length).toBeLessThanOrEqual(3)
  })

  it('only lists items and champions that exist', () => {
    const itemIds = new Set(gameData.items.map(({ id }) => id))
    const championIds = new Set(gameData.champions.map(({ id }) => id))
    expect(Object.keys(ITEM_BUYERS).filter((id) => !itemIds.has(id))).toEqual([])
    expect(Object.keys(CHAMPION_BUILDS).filter((id) => !championIds.has(id))).toEqual([])
  })

  it('has items for every build profile, so every champion can get a full build', () => {
    for (const profile of BUILD_PROFILES) {
      const items = Object.values(ITEM_BUYERS).filter((buyers) => buyers.includes(profile))
      expect(items.length, profile).toBeGreaterThanOrEqual(5)
    }
  })
})

describe('buildProfiles', () => {
  it('uses the table, or guesses from the class for an unknown champion', () => {
    expect(buildProfiles(makeChampion({ id: 'Jinx' }))).toEqual(['crit'])
    expect(buildProfiles(makeChampion({ id: 'Newcomer', classes: ['Assassin'], damageType: 'AP' }))).toEqual(['apAssassin'])
    expect(guessBuildProfiles(makeChampion({ classes: ['Support'], damageType: 'AD' }))).toEqual(['engage'])
  })
})
