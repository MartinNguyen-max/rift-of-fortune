import { describe, expect, it } from 'vitest'
import { gameData } from '../../data'
import { seededRandom } from '../random'
import { rateTeam } from '../scoring/rateTeam'
import { simulateGame } from '../scoring/simulate'
import { simulateMatch } from './simulateMatch'
import { sampleTeams } from './testUtils'
import type { MatchTeams, Scoreboard, SideScore } from './types'
import { blueWinChance, formatWinChance, winChanceTimeline } from './winChance'

const teams = sampleTeams()
const even: MatchTeams = { blue: teams.blue, red: { ...teams.blue, name: 'Team Bot' } }
const side = (overrides: Partial<SideScore> = {}): SideScore => ({
  kills: 0,
  towers: 0,
  dragons: 0,
  barons: 0,
  inhibitors: 0,
  gold: 30000,
  ...overrides,
})
const score = (blue: Partial<SideScore>, red: Partial<SideScore> = {}): Scoreboard => ({ blue: side(blue), red: side(red) })

describe('blueWinChance', () => {
  it('is a coin flip for equal teams with an even score', () => {
    expect(blueWinChance(even, null)).toBeCloseTo(0.5)
    expect(blueWinChance(even, score({}))).toBeCloseTo(0.5)
  })

  it('favours the better rated team before the match', () => {
    const chance = blueWinChance(teams, null)
    expect(teams.blue.rating.score).toBeGreaterThan(teams.red.rating.score)
    expect(chance).toBeGreaterThan(0.5)
    expect(chance).toBeLessThan(1)
  })

  it('goes up with a gold lead, towers, inhibitors and Barons', () => {
    const base = blueWinChance(even, score({}))
    expect(blueWinChance(even, score({ gold: 33000 }))).toBeGreaterThan(base)
    expect(blueWinChance(even, score({ towers: 3 }))).toBeGreaterThan(base)
    expect(blueWinChance(even, score({ inhibitors: 1 }))).toBeGreaterThan(base)
    expect(blueWinChance(even, score({ barons: 1 }))).toBeGreaterThan(base)
  })

  it('is the same from either side', () => {
    const swapped: MatchTeams = { blue: teams.red, red: teams.blue }
    const lead = score({ gold: 34000, towers: 4 }, { inhibitors: 1 })
    const mirrored = score({ inhibitors: 1 }, { gold: 34000, towers: 4 })
    expect(blueWinChance(teams, lead)).toBeCloseTo(1 - blueWinChance(swapped, mirrored))
  })
})

describe('winChanceTimeline', () => {
  it('has one value before the match and one per event, ending on the winner', () => {
    for (let seed = 0; seed < 10; seed++) {
      const match = simulateMatch(teams, seed)
      const timeline = winChanceTimeline(match, teams)
      expect(timeline).toHaveLength(match.events.length + 1)
      expect(timeline.at(-1)).toBe(match.winner === 'blue' ? 1 : 0)
    }
  })

  it('is honest: teams shown at 60–80% win about that often', () => {
    const random = seededRandom(7)
    let shown = 0
    let won = 0
    for (let pair = 0; pair < 60; pair++) {
      const strategy = () => (random() < 0.5 ? 'sensible' : 'random')
      const matchTeams: MatchTeams = {
        blue: { name: 'Your team', rating: rateTeam(simulateGame(gameData, strategy(), random)) },
        red: { name: 'Team Bot', rating: rateTeam(simulateGame(gameData, strategy(), random)) },
      }
      for (let game = 0; game < 10; game++) {
        const match = simulateMatch(matchTeams, Math.floor(random() * 1e9))
        for (const chance of winChanceTimeline(match, matchTeams).slice(0, -1)) {
          const favourite = chance >= 0.5 ? 'blue' : 'red'
          const value = Math.max(chance, 1 - chance)
          if (value < 0.6 || value >= 0.8) continue
          shown += 1
          if (match.winner === favourite) won += 1
        }
      }
    }
    expect(shown).toBeGreaterThan(500)
    expect(won / shown).toBeGreaterThan(0.62)
    expect(won / shown).toBeLessThan(0.78)
  })
})

describe('formatWinChance', () => {
  it('rounds to whole percentages that add up to 100', () => {
    expect(formatWinChance(0.623)).toEqual({ blue: 62, red: 38 })
    expect(formatWinChance(0.5)).toEqual({ blue: 50, red: 50 })
  })

  it('never shows 0% or 100% until the match is decided', () => {
    expect(formatWinChance(0.999)).toEqual({ blue: 99, red: 1 })
    expect(formatWinChance(0.001)).toEqual({ blue: 1, red: 99 })
    expect(formatWinChance(1)).toEqual({ blue: 100, red: 0 })
    expect(formatWinChance(0)).toEqual({ blue: 0, red: 100 })
  })
})
