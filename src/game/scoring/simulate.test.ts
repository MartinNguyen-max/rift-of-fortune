import { describe, expect, it } from 'vitest'
import { gameData } from '../../data'
import { rankFor } from './rank'
import { seededRandom } from '../random'
import { percentile, simulateGame, simulateScores } from './simulate'

const GAMES = 2000

describe('simulateGame', () => {
  it('builds a full team with two items each', () => {
    const team = simulateGame(gameData, 'sensible', seededRandom(1))
    expect(team).toHaveLength(5)
    expect(new Set(team.map(({ champion }) => champion.id)).size).toBe(5)
    for (const { items } of team) expect(items).toHaveLength(2)
  })

  it('is reproducible with the same seed', () => {
    expect(simulateScores(gameData, 'random', 20, 3)).toEqual(simulateScores(gameData, 'random', 20, 3))
  })
})

/** Guards the rank calibration: changing scoring numbers should not quietly make ranks too easy or too hard. */
describe('rank calibration', () => {
  const sensible = simulateScores(gameData, 'sensible', GAMES)
  const random = simulateScores(gameData, 'random', GAMES)
  const share = (scores: number[], test: (score: number) => boolean) => scores.filter(test).length / scores.length

  it('puts a sensible player around Gold or Platinum on average', () => {
    expect(['Gold', 'Platinum']).toContain(rankFor(percentile(sensible, 0.5)).tier)
  })

  it('puts a random player in Iron or Bronze on average', () => {
    expect(['Iron', 'Bronze']).toContain(rankFor(percentile(random, 0.5)).tier)
  })

  it('makes Challenger reachable but very rare: about 1 in 100–200 games for a near-perfect player', () => {
    const challenger = share(sensible, (score) => rankFor(score).tier === 'Challenger')
    expect(challenger).toBeGreaterThan(0.002)
    expect(challenger).toBeLessThan(0.02)
  })

  it('keeps Diamond or higher to about 1 in 10 games for a sensible player', () => {
    const diamondPlus = share(sensible, (score) => ['Diamond', 'Master', 'Grandmaster', 'Challenger'].includes(rankFor(score).tier))
    expect(diamondPlus).toBeGreaterThan(0.03)
    expect(diamondPlus).toBeLessThan(0.12)
  })

  it('rewards knowing the game: a sensible player scores far above a random one', () => {
    expect(percentile(sensible, 0.5) - percentile(random, 0.5)).toBeGreaterThanOrEqual(20)
  })
})
