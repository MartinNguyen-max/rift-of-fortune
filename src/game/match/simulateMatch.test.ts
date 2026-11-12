import { describe, expect, it } from 'vitest'
import { gameData } from '../../data'
import { seededRandom } from '../random'
import { ROLES } from '../roles'
import { rateTeam, type TeamRating } from '../scoring/rateTeam'
import { simulateGame } from '../scoring/simulate'
import { DRAGONS_FOR_SOUL, TOWERS_FOR_INHIBITOR, MATCH_TIMES } from './config'
import { simulateMatch } from './simulateMatch'
import type { MatchResult, MatchTeams } from './types'

/** A mix of sensible and random teams, so team scores range from Iron to Challenger. */
function ratingPool(size: number, seed: number): TeamRating[] {
  const random = seededRandom(seed)
  return Array.from({ length: size }, (_, index) =>
    rateTeam(simulateGame(gameData, index % 2 === 0 ? 'sensible' : 'random', random)),
  )
}

const teams = (blue: TeamRating, red: TeamRating): MatchTeams => ({
  blue: { name: 'Blue', rating: blue },
  red: { name: 'Red', rating: red },
})

const pool = ratingPool(300, 11)
const [first, second] = pool as [TeamRating, TeamRating]

/** Plays many matches between random pairs from the pool. */
function playMany(count: number, seed: number) {
  const random = seededRandom(seed)
  const pick = () => pool[Math.floor(random() * pool.length)] as TeamRating
  return Array.from({ length: count }, (_, index) => {
    const blue = pick()
    const red = pick()
    return { blue, red, match: simulateMatch(teams(blue, red), seed * 100_000 + index) }
  })
}

const games = playMany(3000, 5)
const lastEvent = (match: MatchResult) => match.events[match.events.length - 1]

describe('simulateMatch', () => {
  const match = simulateMatch(teams(first, second), 42)

  it('is reproducible with the same seed', () => {
    expect(simulateMatch(teams(first, second), 42)).toEqual(match)
  })

  it('plays out differently with another seed', () => {
    expect(simulateMatch(teams(first, second), 43).events).not.toEqual(match.events)
  })

  it('ends with the Nexus or a surrender by the winner', () => {
    for (const { match: game } of games.slice(0, 200)) {
      const last = lastEvent(game)
      expect(['nexus', 'surrender']).toContain(last?.kind)
      expect(last?.side).toBe(game.winner)
      expect(game.duration).toBe(last?.time)
    }
  })

  it('keeps events in time order', () => {
    const times = match.events.map(({ time }) => time)
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('keeps the scoreboard in line with the champion stats', () => {
    const last = lastEvent(match)
    for (const side of ['blue', 'red'] as const) {
      const kills = ROLES.reduce((sum, role) => sum + match.stats[side][role].kills, 0)
      expect(last?.score[side].kills).toBe(kills)
    }
    const blueDeaths = ROLES.reduce((sum, role) => sum + match.stats.blue[role].deaths, 0)
    expect(last?.score.red.kills).toBe(blueDeaths)
  })

  it('tags first blood on the first kill only', () => {
    for (const { match: game } of games.slice(0, 200)) {
      const firstBloods = game.events.filter(({ tags }) => tags.includes('firstBlood'))
      expect(firstBloods).toHaveLength(1)
      const firstKill = game.events.find(({ score }) => score.blue.kills + score.red.kills > 0)
      expect(firstBloods[0]).toBe(firstKill)
    }
  })

  it('gives dragon soul on the fourth dragon and spawns Elder only after it', () => {
    for (const { match: game } of games.slice(0, 300)) {
      const soul = game.events.find(({ tags }) => tags.includes('soul'))
      if (soul) expect(soul.score[soul.side].dragons).toBe(DRAGONS_FOR_SOUL)
      const elder = game.events.find(({ kind }) => kind === 'elder')
      if (elder) expect(soul && soul.time < elder.time).toBe(true)
      for (const { score } of game.events) expect(score.blue.dragons + score.red.dragons).toBeLessThanOrEqual(7)
    }
  })

  it('only opens inhibitors after enough towers, and the Nexus only after an inhibitor', () => {
    for (const { match: game } of games.slice(0, 300)) {
      for (const [index, event] of game.events.entries()) {
        if (event.kind === 'inhibitor') {
          expect(event.time).toBeGreaterThanOrEqual(MATCH_TIMES.inhibitorsFrom)
          expect(event.score[event.side].towers).toBeGreaterThanOrEqual(TOWERS_FOR_INHIBITOR)
        }
        if (event.kind === 'nexus') {
          const inhibitors = game.events.slice(0, index).filter(({ kind, side }) => kind === 'inhibitor' && side === event.side)
          expect(inhibitors.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('only steals Baron after 20 minutes', () => {
    for (const { match: game } of games) {
      for (const { kind, time } of game.events) if (kind === 'baron') expect(time).toBeGreaterThanOrEqual(MATCH_TIMES.baronSpawn)
    }
  })
})

/** Guards the balancing targets from docs/match-simulation.md. */
describe('match balancing', () => {
  const betterWinRate = (minDiff: number, maxDiff: number) => {
    const inRange = games.filter(({ blue, red }) => {
      const diff = Math.abs(blue.score - red.score)
      return diff >= minDiff && diff <= maxDiff
    })
    const wins = inRange.filter(({ blue, red, match }) => match.winner === (blue.score >= red.score ? 'blue' : 'red'))
    return wins.length / inRange.length
  }

  it('gives two equal teams about a coin flip', () => {
    const rating = first
    const wins = Array.from({ length: 1000 }, (_, seed) => simulateMatch(teams(rating, rating), seed)).filter(
      ({ winner }) => winner === 'blue',
    ).length
    expect(wins / 1000).toBeGreaterThan(0.45)
    expect(wins / 1000).toBeLessThan(0.55)
  })

  it('lets a team 8–12 points better win about two thirds of the time', () => {
    const rate = betterWinRate(8, 12)
    expect(rate).toBeGreaterThan(0.6)
    expect(rate).toBeLessThan(0.75)
  })

  it('still lets a team 28–35 points worse win sometimes', () => {
    const rate = betterWinRate(28, 35)
    expect(rate).toBeGreaterThan(0.85)
    expect(rate).toBeLessThan(0.96)
  })

  it('makes an average match last 25–35 minutes with 15–35 kills', () => {
    const minutes = games.reduce((sum, { match }) => sum + match.duration, 0) / games.length / 60
    const kills =
      games.reduce((sum, { match }) => {
        const last = lastEvent(match)
        return sum + (last ? last.score.blue.kills + last.score.red.kills : 0)
      }, 0) / games.length
    expect(minutes).toBeGreaterThan(25)
    expect(minutes).toBeLessThan(35)
    expect(kills).toBeGreaterThan(15)
    expect(kills).toBeLessThan(35)
  })

  it('has at least one big moment before the end in almost every match', () => {
    const withMoment = games.filter(({ match }) =>
      match.events.some(({ big, kind }) => big && kind !== 'nexus' && kind !== 'surrender'),
    )
    expect(withMoment.length / games.length).toBeGreaterThan(0.95)
  })

  it('has steals and surrenders, but not too many', () => {
    const share = (test: (match: MatchResult) => boolean) => games.filter(({ match }) => test(match)).length / games.length
    const baronSteals = share((match) => match.events.some(({ kind, tags }) => kind === 'baron' && tags.includes('steal')))
    const surrenders = share((match) => lastEvent(match)?.kind === 'surrender')
    expect(baronSteals).toBeGreaterThan(0.03)
    expect(baronSteals).toBeLessThan(0.25)
    expect(surrenders).toBeGreaterThan(0.02)
    expect(surrenders).toBeLessThan(0.15)
  })
})
