import { describe, expect, it } from 'vitest'
import { parseRoute, roomCodeFromHash, roomHref, routeHref } from './useHashRoute'

describe('parseRoute', () => {
  it.each([
    ['#/daily', 'daily'],
    ['#/classic', 'classic'],
    ['#/match', 'match'],
    ['#/play', 'play'],
    ['#/play/K7Q2X', 'play'],
    ['#daily', 'daily'],
    ['#/', 'home'],
    ['', 'home'],
    ['#/nope', 'home'],
  ])('parses %s as %s', (hash, route) => {
    expect(parseRoute(hash)).toBe(route)
  })

  it('round-trips with routeHref', () => {
    for (const route of ['home', 'classic', 'daily', 'match', 'play'] as const) {
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
