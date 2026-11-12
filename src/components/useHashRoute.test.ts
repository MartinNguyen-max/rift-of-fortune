import { describe, expect, it } from 'vitest'
import { miniGameFromHash, miniGameHref, parseRoute, roomCodeFromHash, roomHref, routeHref } from './useHashRoute'

describe('parseRoute', () => {
  it.each([
    ['#/daily', 'daily'],
    ['#/classic', 'classic'],
    ['#/match', 'match'],
    ['#/play', 'play'],
    ['#/play/K7Q2X', 'play'],
    ['#/minigames', 'minigames'],
    ['#/minigames/hook', 'minigames'],
    ['#daily', 'daily'],
    ['#/', 'home'],
    ['', 'home'],
    ['#/nope', 'home'],
  ])('parses %s as %s', (hash, route) => {
    expect(parseRoute(hash)).toBe(route)
  })

  it('round-trips with routeHref', () => {
    for (const route of ['home', 'classic', 'daily', 'match', 'play', 'minigames'] as const) {
      expect(parseRoute(routeHref(route))).toBe(route)
    }
  })
})

describe('roomCodeFromHash', () => {
  it('reads the lobby code from the URL', () => {
    expect(roomCodeFromHash(roomHref('K7Q2X'))).toBe('K7Q2X')
    expect(roomCodeFromHash('#/play/k7q2x')).toBe('K7Q2X')
  })

  it('is null without a valid code', () => {
    expect(roomCodeFromHash('#/play')).toBeNull()
    expect(roomCodeFromHash('#/play/nope')).toBeNull()
    expect(roomCodeFromHash('#/daily/K7Q2X')).toBeNull()
  })
})

describe('miniGameFromHash', () => {
  it('reads the mini-game from the URL', () => {
    expect(miniGameFromHash(miniGameHref('hook'))).toBe('hook')
    expect(miniGameFromHash('#/minigames')).toBeNull()
    expect(miniGameFromHash('#/minigames/nope')).toBeNull()
    expect(miniGameFromHash('#/play/hook')).toBeNull()
  })
})
