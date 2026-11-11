import { describe, expect, it } from 'vitest'
import {
  beatenShare,
  dailyNumber,
  dailyRolls,
  dateKey,
  formatCountdown,
  msUntilNextDaily,
  scoreEmoji,
  shareText,
} from './daily'
import { ITEM_COUNT } from './items'
import { rankFor } from './scoring/rank'
import type { TeamRating } from './scoring/rateTeam'
import { makeChampion, makeItem } from './testUtils'

const data = {
  champions: Array.from({ length: 30 }, (_, i) => makeChampion({ id: `C${i}` })),
  items: Array.from({ length: 30 }, (_, i) => makeItem({ id: `I${i}` })),
}

describe('dateKey and dailyNumber', () => {
  it('uses the local calendar date', () => {
    expect(dateKey(new Date(2026, 10, 11, 23, 59))).toBe('2026-11-11')
    expect(dateKey(new Date(2027, 0, 5, 0, 1))).toBe('2027-01-05')
  })

  it('starts at #1 and counts days, also across a daylight saving change', () => {
    expect(dailyNumber(new Date(2026, 10, 11, 8))).toBe(1)
    expect(dailyNumber(new Date(2026, 10, 12, 0, 0))).toBe(2)
    expect(dailyNumber(new Date(2027, 3, 1, 12))).toBe(142)
  })
})

describe('dailyRolls', () => {
  it('gives everyone the same rolls on the same day', () => {
    const morning = dailyRolls(data, new Date(2026, 10, 11, 8))
    const evening = dailyRolls(data, new Date(2026, 10, 11, 22))
    expect(evening).toEqual(morning)
  })

  it('gives different rolls on different days', () => {
    expect(dailyRolls(data, new Date(2026, 10, 12))).not.toEqual(dailyRolls(data, new Date(2026, 10, 11)))
  })

  it('rolls five different champions and ten different items', () => {
    const { champions, items } = dailyRolls(data, new Date(2026, 10, 11))
    expect(new Set(champions.map(({ id }) => id)).size).toBe(5)
    expect(new Set(items.map(({ id }) => id)).size).toBe(ITEM_COUNT)
  })
})

describe('countdown', () => {
  it('counts down to local midnight', () => {
    expect(msUntilNextDaily(new Date(2026, 10, 11, 23, 0, 0))).toBe(60 * 60 * 1000)
  })

  it('formats hours, minutes and seconds', () => {
    expect(formatCountdown((5 * 3600 + 4 * 60 + 9) * 1000)).toBe('5h 04m 09s')
    expect(formatCountdown(-1)).toBe('0h 00m 00s')
  })
})

describe('share', () => {
  const rating = {
    score: 61,
    rank: rankFor(61),
    champions: [
      { role: 'TOP', score: 90 },
      { role: 'BOTTOM', score: 55 },
      { role: 'SUPPORT', score: 10 },
    ],
  } as TeamRating

  it('colours scores like the UI', () => {
    expect([scoreEmoji(75), scoreEmoji(50), scoreEmoji(49)]).toEqual(['🟩', '🟨', '🟥'])
  })

  it('works out how many other players you beat', () => {
    expect(beatenShare({ players: 101, beaten: 64 })).toBe(64)
    expect(beatenShare({ players: 1, beaten: 0 })).toBeNull()
  })

  it('builds spoiler-free share text', () => {
    const text = shareText(3, rating, 'https://example.com/#/daily', { players: 11, beaten: 5 })
    expect(text).toBe(
      [
        'Rift of Fortune · Daily #3',
        'Gold I · 61/100',
        'Top 🟩 ADC 🟨 Sup 🟥',
        'Beat 50% of players today',
        'https://example.com/#/daily',
      ].join('\n'),
    )
  })

  it('leaves out the comparison when there are no stats', () => {
    expect(shareText(3, rating, 'url', null)).not.toContain('Beat')
  })
})
