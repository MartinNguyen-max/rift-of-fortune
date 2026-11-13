import { describe, expect, it } from 'vitest'
import {
  BOT_REACTION,
  bestReaction,
  botShots,
  DRAW_DELAY,
  drawTimes,
  DUEL_RULES,
  duelResults,
  duelRound,
  NO_SHOT,
  TARGET_AREA,
  targetSpots,
} from './duel'
import { soloSetup } from './versus'

describe('drawTimes and botShots', () => {
  it('are the same for the same seed, with 3 rounds', () => {
    expect(drawTimes(7)).toEqual(drawTimes(7))
    expect(drawTimes(7)).toHaveLength(3)
  })

  it('draws within the delay range; the bot shoots in its reaction range or early', () => {
    for (let seed = 0; seed < 200; seed++) {
      const draws = drawTimes(seed)
      botShots(seed).forEach((shot, round) => {
        const drawAt = draws[round] ?? 0
        expect(drawAt).toBeGreaterThanOrEqual(DRAW_DELAY.min * 1000)
        expect(drawAt).toBeLessThanOrEqual(DRAW_DELAY.max * 1000)
        const reaction = shot - drawAt
        expect(reaction < 0 || (reaction >= BOT_REACTION.min * 1000 - 1 && reaction <= BOT_REACTION.max * 1000 + 1)).toBe(true)
      })
    }
  })
})

describe('targetSpots', () => {
  it('puts the Baron in the same spots for both players, one per round', () => {
    expect(targetSpots(7)).toEqual(targetSpots(7))
    expect(targetSpots(7)).toHaveLength(3)
    expect(targetSpots(7)).not.toEqual(targetSpots(8))
  })

  it('keeps it inside the arena and moves it to the other half each round', () => {
    const middle = (TARGET_AREA.left + TARGET_AREA.right) / 2
    for (let seed = 0; seed < 200; seed++) {
      const spots = targetSpots(seed)
      for (const { x, y } of spots) {
        expect(x).toBeGreaterThanOrEqual(TARGET_AREA.left)
        expect(x).toBeLessThanOrEqual(TARGET_AREA.right)
        expect(y).toBeGreaterThanOrEqual(TARGET_AREA.top)
        expect(y).toBeLessThanOrEqual(TARGET_AREA.bottom)
      }
      const sides = spots.map(({ x }) => x > middle)
      expect(sides[0]).not.toBe(sides[1])
      expect(sides[1]).not.toBe(sides[2])
    }
  })

  it('starts on the left about as often as on the right', () => {
    const middle = (TARGET_AREA.left + TARGET_AREA.right) / 2
    const right = Array.from({ length: 400 }, (_, seed) => (targetSpots(seed)[0]?.x ?? 0) > middle).filter(Boolean).length
    expect(right).toBeGreaterThan(150)
    expect(right).toBeLessThan(250)
  })
})

describe('duelRound', () => {
  it('gives the round to the first tap after the Baron shows', () => {
    expect(duelRound(3000, [3200, 3300], 0)).toEqual({ winner: 0, reason: 'faster', reactions: [200, 300] })
    expect(duelRound(3000, [3400, 3300], 0).winner).toBe(1)
  })

  it('makes whoever taps before the Baron shows lose, the first one if both did', () => {
    expect(duelRound(3000, [2900, 3300], 0)).toMatchObject({ winner: 1, reason: 'early' })
    expect(duelRound(3000, [3500, 2500], 0)).toMatchObject({ winner: 0, reason: 'early' })
    expect(duelRound(3000, [2600, 2800], 0).winner).toBe(1)
  })

  it('treats no shot as the slowest shot', () => {
    expect(duelRound(3000, [NO_SHOT, 3300], 0).winner).toBe(1)
  })
})

describe('DUEL_RULES', () => {
  const setup = soloSetup(1)
  const draws = drawTimes(1)
  const fast = draws.map((drawAt) => drawAt + 150)
  const slow = draws.map((drawAt) => drawAt + 500)

  it('needs 2 round wins', () => {
    expect(DUEL_RULES.settle([[fast[0]], [slow[0]]], setup)).toBeNull()
    expect(DUEL_RULES.settle([fast.slice(0, 2), slow.slice(0, 2)], setup)).toEqual({ winner: 0, scores: [2, 0] })
  })

  it('owes the next round from both players until decided', () => {
    expect(DUEL_RULES.owed([[fast[0]], []], setup)).toEqual([{ player: 1, step: 0 }])
    expect(DUEL_RULES.owed([fast.slice(0, 2), slow.slice(0, 2)], setup)).toEqual([])
  })

  it('keeps the best reaction as the personal best', () => {
    const results = duelResults([fast.slice(0, 2), slow.slice(0, 2)], 1)
    expect(bestReaction(results, 0)).toBe(150)
    expect(DUEL_RULES.best?.of([fast.slice(0, 2), slow.slice(0, 2)], setup)).toBe(150)
  })
})
