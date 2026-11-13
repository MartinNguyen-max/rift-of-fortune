import { describe, expect, it } from 'vitest'
import { MINI_GAME_IDS } from '../minigames/catalog'
import { seededRandom } from '../random'
import { defaultSettings, draftRules, parseSettings, toggleGame, withEventMode } from './settings'

describe('lobby settings', () => {
  const settings = defaultSettings(seededRandom(3))

  it('defaults to normal pace, rerolls, 3 random games, one role and finisher animations', () => {
    expect(settings).toMatchObject({ pace: 'normal', rerolls: true, eventMode: 'random3', bothRoles: false, animations: true })
    expect(new Set(settings.games).size).toBe(3)
  })

  it('rolls new random games for a random mode', () => {
    expect(withEventMode(settings, 'random5', seededRandom(4)).games).toHaveLength(5)
    expect(withEventMode(settings, 'custom').games).toEqual(settings.games)
  })

  it('switches custom games on and off, keeping at least one, in catalog order', () => {
    const one = { ...settings, games: ['hook' as const] }
    expect(toggleGame(one, 'hook').games).toEqual(['hook'])
    const two = toggleGame(one, 'duel')
    expect(two).toMatchObject({ eventMode: 'custom', games: ['duel', 'hook'] })
    expect(toggleGame(two, 'duel').games).toEqual(['hook'])
  })

  it('turns pace and rerolls into draft rules', () => {
    expect(draftRules(settings)).toEqual({ championRerolls: 3, itemRerolls: 3, pace: 'normal' })
    expect(draftRules({ ...settings, rerolls: false, pace: 'fast' })).toEqual({ championRerolls: 0, itemRerolls: 0, pace: 'fast' })
  })

  it('parses settings from the network and drops broken ones', () => {
    expect(parseSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings)
    expect(parseSettings({ ...settings, games: [] })).toBeNull()
    expect(parseSettings({ ...settings, games: ['duel', 'duel'] })).toBeNull()
    expect(parseSettings({ ...settings, games: [...MINI_GAME_IDS, 'duel'] })).toBeNull()
    expect(parseSettings({ ...settings, pace: 'turbo' })).toBeNull()
    expect(parseSettings({ ...settings, animations: 'yes' })).toBeNull()
    expect(parseSettings(null)).toBeNull()
  })

  it('turns animations on for settings from a version without them', () => {
    const older: Partial<typeof settings> = { ...settings }
    delete older.animations
    expect(parseSettings(older)?.animations).toBe(true)
  })
})
