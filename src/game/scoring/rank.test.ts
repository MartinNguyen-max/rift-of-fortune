import { describe, expect, it } from 'vitest'
import { RANK_TIERS } from '../../data/types'
import { RANK_THRESHOLDS } from './config'
import { rankFor, rankLabel } from './rank'

describe('rankFor', () => {
  it.each([
    [100, 'Challenger'],
    [95, 'Challenger'],
    [92, 'Grandmaster'],
    [85, 'Master'],
    [84, 'Diamond I'],
    [78, 'Diamond IV'],
    [70, 'Emerald IV'],
    [62, 'Platinum IV'],
    [54, 'Gold IV'],
    [61, 'Gold I'],
    [45, 'Silver IV'],
    [35, 'Bronze IV'],
    [34, 'Iron I'],
    [0, 'Iron IV'],
  ])('ranks a score of %i as %s', (score, label) => {
    expect(rankLabel(rankFor(score))).toBe(label)
  })

  it('splits a tier evenly into four divisions', () => {
    // Gold covers 54–61: two points per division.
    expect([54, 55, 56, 57, 58, 59, 60, 61].map((score) => rankFor(score).division)).toEqual([
      'IV',
      'IV',
      'III',
      'III',
      'II',
      'II',
      'I',
      'I',
    ])
  })

  it('gives Master and above no division', () => {
    expect(rankFor(88).division).toBeNull()
    expect(rankFor(100).division).toBeNull()
  })

  it('treats scores below zero as Iron IV', () => {
    expect(rankLabel(rankFor(-5))).toBe('Iron IV')
  })

  it('has a threshold for every ranked tier', () => {
    expect(RANK_THRESHOLDS.map(({ tier }) => tier).toSorted()).toEqual([...RANK_TIERS].sort())
  })

  it('has a summary for every tier', () => {
    for (const { min, tier } of RANK_THRESHOLDS) {
      const rank = rankFor(min)
      expect(rank.tier).toBe(tier)
      expect(rank.summary.length).toBeGreaterThan(0)
    }
  })
})
