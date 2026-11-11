import { describe, expect, it } from 'vitest'
import { parseRoute, routeHref } from './useHashRoute'

describe('parseRoute', () => {
  it.each([
    ['#/daily', 'daily'],
    ['#/classic', 'classic'],
    ['#daily', 'daily'],
    ['#/', 'home'],
    ['', 'home'],
    ['#/nope', 'home'],
  ])('parses %s as %s', (hash, route) => {
    expect(parseRoute(hash)).toBe(route)
  })

  it('round-trips with routeHref', () => {
    for (const route of ['home', 'classic', 'daily'] as const) expect(parseRoute(routeHref(route))).toBe(route)
  })
})
