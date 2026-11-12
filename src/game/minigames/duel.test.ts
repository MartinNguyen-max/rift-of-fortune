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

describe('duelRound', () => {
  it('gives the round to the first shot after DRAW', () => {
    expect(duelRound(3000, [3200, 3300], 0)).toEqual({ winner: 0, reason: 'faster', reactions: [200, 300] })
    expect(duelRound(3000, [3400, 3300], 0).winner).toBe(1)
  })

  it('makes whoever shoots before DRAW lose, the first one if both did', () => {
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
