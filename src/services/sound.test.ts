import { describe, expect, it } from 'vitest'
import { RANK_TIERS, SOUND_FILES } from '../data/types'
import { DEFAULT_SOUND_SETTINGS, parseSoundSettings, RANK_SOUNDS } from './sound'

describe('parseSoundSettings', () => {
  it('starts with quiet effects on and music off', () => {
    expect(DEFAULT_SOUND_SETTINGS).toEqual({ effects: true, music: false })
    expect(parseSoundSettings(null)).toEqual(DEFAULT_SOUND_SETTINGS)
  })

  it('keeps the saved choices', () => {
    expect(parseSoundSettings({ effects: false, music: true })).toEqual({ effects: false, music: true })
  })

  it('falls back to the defaults for anything missing or broken', () => {
    expect(parseSoundSettings({ music: 'yes' })).toEqual(DEFAULT_SOUND_SETTINGS)
    expect(parseSoundSettings('loud')).toEqual(DEFAULT_SOUND_SETTINGS)
  })
})

describe('RANK_SOUNDS', () => {
  it('has a sound for every ranked tier', () => {
    for (const tier of RANK_TIERS) expect(SOUND_FILES[RANK_SOUNDS[tier]]).toBeDefined()
  })
})
