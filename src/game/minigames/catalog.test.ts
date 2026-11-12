import { describe, expect, it } from 'vitest'
import { gameData } from '../../data'
import { MINI_GAME_IDS, MINI_GAMES, parseMiniGameId, winnerByScore } from './catalog'

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

describe('winnerByScore', () => {
  it('lets the higher score win, or the lower one for times', () => {
    expect(winnerByScore(500, 300)).toBe('player')
    expect(winnerByScore(300, 500)).toBe('bot')
    expect(winnerByScore(12.5, 14, true)).toBe('player')
    expect(winnerByScore(5, 5)).toBe('draw')
  })
})
