import { describe, expect, it } from 'vitest'
import { gameData } from '../../data'
import { seededRandom } from '../random'
import { laneChampions, laneResults, lanesOutcome, laneTeam, LANE_ORDER, livesLeft, type LaneResult } from './lanes'
import { tieBreaker } from './liveEvents'
import type { LiveEventState } from './session'

const event = (result: LiveEventState['result']): LiveEventState => ({
  openedAt: 0,
  arrived: [],
  ready: [],
  readyAt: 0,
  moves: [[], []],
  result,
})
const won = (winner: 'blue' | 'red') => event({ winner, scores: { blue: 1, red: 0 }, tie: false })
const tie = event({ winner: 'red', scores: { blue: 1, red: 1 }, tie: true })

describe('laneTeam', () => {
  it('gives every lane a different champion who plays that role', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const team = laneTeam(gameData.champions, seededRandom(seed))
      expect(team.map(({ role }) => role)).toEqual([...LANE_ORDER])
      expect(new Set(team.map(({ champion }) => champion)).size).toBe(5)
      for (const { role, champion } of team) {
        expect(gameData.champions.find(({ id }) => id === champion)?.positions[0], `${champion} in ${role}`).toBe(role)
      }
    }
  })

  it('reads both line-ups back by lane, host on blue', () => {
    const blue = laneTeam(gameData.champions, seededRandom(1))
    const red = laneTeam(gameData.champions, seededRandom(2))
    const lineUps = laneChampions({ match: { seed: 1, teams: [blue, red], startedAt: 0 } }, gameData.champions)
    expect(lineUps?.blue.map((champion) => champion?.id)).toEqual(blue.map(({ champion }) => champion))
    expect(lineUps?.red[4]?.id).toBe(red[4]?.champion)
    expect(laneChampions({ match: null }, gameData.champions)).toBeNull()
  })
})

describe('lane results', () => {
  it('lists the decided lanes in order, a tie as a draw, stopping at the first open one', () => {
    expect(laneResults({ events: [won('blue'), tie, event(null), won('red')] })).toEqual(['blue', 'draw'])
  })

  it('takes a life for every lane lost, none for a draw', () => {
    const results: LaneResult[] = ['blue', 'draw', 'red', 'blue']
    expect(livesLeft(results, 'blue')).toBe(4)
    expect(livesLeft(results, 'red')).toBe(3)
  })

  it('needs every lane fought before there is a winner', () => {
    expect(lanesOutcome(['blue', 'blue', 'blue'], 5, 7)).toBeNull()
  })

  it('goes to the side with the most lives left', () => {
    expect(lanesOutcome(['blue', 'red', 'draw', 'red', 'draw'], 5, 7)).toEqual({ winner: 'red', lives: { blue: 3, red: 4 }, coinFlip: false })
  })

  it('flips a coin, the same for both players, when the lives are level', () => {
    const level = lanesOutcome(['blue', 'red', 'draw', 'draw', 'draw'], 5, 7)
    expect(level).toMatchObject({ coinFlip: true, lives: { blue: 4, red: 4 }, winner: tieBreaker(7, 5) })
  })
})
