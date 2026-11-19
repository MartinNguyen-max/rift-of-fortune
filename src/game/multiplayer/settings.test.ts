import { describe, expect, it } from 'vitest'
import { MINI_GAME_IDS } from '../minigames/catalog'
import { seededRandom } from '../random'
import {
  defaultSettings,
  draftRules,
  isTeamOnly,
  LANE_GAMES,
  parseSettings,
  settingsReady,
  toggleGame,
  withEventMode,
  withMode,
  type LobbySettings,
} from './settings'

describe('lobby settings', () => {
  const teamOnly = defaultSettings()
  const settings: LobbySettings = withEventMode(teamOnly, 'random3', seededRandom(3))

  it('defaults to a draft battle, rerolls, no live events, one role and no finisher animations', () => {
    expect(teamOnly).toEqual({ mode: 'draft', rerolls: true, eventMode: 'none', games: [], bothRoles: false, animations: false })
    expect(isTeamOnly(teamOnly)).toBe(true)
    expect(settingsReady(teamOnly)).toBe(true)
  })

  it('rolls new random games for a random mode', () => {
    expect(new Set(settings.games).size).toBe(3)
    expect(isTeamOnly(settings)).toBe(false)
    expect(withEventMode(settings, 'random5', seededRandom(4)).games).toHaveLength(5)
    expect(withEventMode(settings, 'custom').games).toEqual(settings.games)
  })

  it('clears the games for no live events, and custom starts from 3 random ones', () => {
    expect(withEventMode(settings, 'none')).toMatchObject({ eventMode: 'none', games: [] })
    const custom = withEventMode(teamOnly, 'custom', seededRandom(7))
    expect(custom.eventMode).toBe('custom')
    expect(new Set(custom.games).size).toBe(3)
  })

  it('switches custom games on and off, keeping at least one, in catalog order', () => {
    const one = { ...settings, games: ['hook' as const] }
    expect(toggleGame(one, 'hook').games).toEqual(['hook'])
    const two = toggleGame(one, 'duel')
    expect(two).toMatchObject({ eventMode: 'custom', games: ['duel', 'hook'] })
    expect(toggleGame(two, 'duel').games).toEqual(['hook'])
  })

  it('turns rerolls into draft rules', () => {
    expect(draftRules(settings)).toEqual({ championRerolls: 3, itemRerolls: 3 })
    expect(draftRules({ ...settings, rerolls: false })).toEqual({ championRerolls: 0, itemRerolls: 0 })
  })

  it('plays the lanes mode with 5 random games, or exactly 5 picked ones', () => {
    const lanes = withMode(settings, 'lanes', seededRandom(5))
    expect(lanes).toMatchObject({ mode: 'lanes', eventMode: 'random5' })
    expect(lanes.games).toHaveLength(LANE_GAMES)
    expect(settingsReady(lanes)).toBe(true)
    expect(withEventMode(lanes, 'random3')).toBe(lanes)
    expect(withEventMode(lanes, 'none')).toBe(lanes)
    expect(withEventMode(lanes, 'random5', seededRandom(6)).games).toHaveLength(5)
    const custom = withEventMode(lanes, 'custom')
    expect(custom).toMatchObject({ mode: 'lanes', eventMode: 'custom', games: lanes.games })
    const missing = MINI_GAME_IDS.find((id) => !custom.games.includes(id)) ?? 'duel'
    expect(toggleGame(custom, missing)).toBe(custom)
    const four = toggleGame(custom, custom.games[0] ?? 'duel')
    expect(four.games).toHaveLength(4)
    expect(settingsReady(four)).toBe(false)
    expect(settingsReady(toggleGame(four, missing))).toBe(true)
    expect(withMode(lanes, 'draft').mode).toBe('draft')
  })

  it('rolls 5 games when switching to lanes from no live events', () => {
    const lanes = withMode(teamOnly, 'lanes', seededRandom(8))
    expect(lanes).toMatchObject({ mode: 'lanes', eventMode: 'random5' })
    expect(lanes.games).toHaveLength(LANE_GAMES)
    expect(isTeamOnly(lanes)).toBe(false)
  })

  it('parses settings from the network and drops broken ones', () => {
    expect(parseSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings)
    expect(parseSettings(JSON.parse(JSON.stringify(teamOnly)))).toEqual(teamOnly)
    expect(parseSettings({ ...settings, games: [] })).toBeNull()
    expect(parseSettings({ ...teamOnly, games: ['duel'] })).toBeNull()
    expect(parseSettings({ ...settings, mode: 'lanes', eventMode: 'none' })).toBeNull()
    expect(parseSettings({ ...settings, games: ['duel', 'duel'] })).toBeNull()
    expect(parseSettings({ ...settings, games: [...MINI_GAME_IDS, 'duel'] })).toBeNull()
    expect(parseSettings({ ...settings, mode: 'turbo' })).toBeNull()
    expect(parseSettings({ ...settings, animations: 'yes' })).toBeNull()
    expect(parseSettings(null)).toBeNull()
  })

  it('leaves animations off for settings from a version without them', () => {
    const older: Partial<typeof settings> = { ...settings }
    delete older.animations
    expect(parseSettings(older)?.animations).toBe(false)
  })
})
