import { describe, expect, it } from 'vitest'
import { RANK_TIERS } from '../../data/types'
import { RANK_THRESHOLDS } from './config'
import { rankFor, rankLabel } from './rank'

describe('rankFor', () => {
  it.each([
    [100, 'Challenger'],
    [88, 'Challenger'],
    [86, 'Grandmaster'],
    [82, 'Master'],
    [81, 'Diamond I'],
    [77, 'Diamond IV'],
    [70, 'Emerald IV'],
    [62, 'Platinum IV'],
    [54, 'Gold IV'],
    [61, 'Gold I'],
    [45, 'Silver IV'],
    [30, 'Bronze IV'],
    [29, 'Iron I'],
    [0, 'Iron IV'],
  ])('ranks a score of %i as %s', (score, label) => {
    expect(rankLabel(rankFor(score))).toBe(label)
  })

  it('splits a tier evenly into four divisions', () => {
    // Silver covers 45–53: nine points, so about two per division.
    expect([45, 47, 48, 49, 50, 51, 52, 53].map((score) => rankFor(score).division)).toEqual([
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
