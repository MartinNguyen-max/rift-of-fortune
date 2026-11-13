import { describe, expect, it } from 'vitest'
import { gameData } from '../../data'
import { MINI_GAME_IDS, MINI_GAMES, parseMiniGameId, tutorialCaptions } from './catalog'
import { MINI_GAME_RULES } from './registry'

describe('catalog', () => {
  it('has every game, each with real champions', () => {
    const championIds = new Set(gameData.champions.map(({ id }) => id))
    for (const id of MINI_GAME_IDS) {
      expect(MINI_GAMES[id].id).toBe(id)
      expect(championIds).toContain(MINI_GAMES[id].champion)
      expect(championIds).toContain(MINI_GAMES[id].botChampion)
    }
  })

  it('parses game ids', () => {
    expect(parseMiniGameId('duel')).toBe('duel')
    expect(parseMiniGameId('nope')).toBeNull()
    expect(parseMiniGameId(undefined)).toBeNull()
  })
})

describe('tutorials and rules', () => {
  it('has three short captions per game, and rules for every game', () => {
    for (const id of MINI_GAME_IDS) {
      for (const live of [false, true]) {
        const captions = tutorialCaptions(MINI_GAMES[id], live)
        expect(captions).toHaveLength(3)
        for (const caption of captions) expect(caption.length).toBeLessThanOrEqual(44)
      }
      expect(MINI_GAME_RULES[id].liveSeconds({ seed: 1, variant: 'live', bothRoles: true, late: false })).toBeLessThan(80)
    }
  })
})
