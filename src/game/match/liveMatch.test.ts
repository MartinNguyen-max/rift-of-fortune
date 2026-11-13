import { describe, expect, it } from 'vitest'
import { gameData } from '../../data'
import type { MiniGameId } from '../minigames/catalog'
import { liveEvents } from '../multiplayer/liveEvents'
import { seededRandom } from '../random'
import { rateTeam, type TeamRating } from '../scoring/rateTeam'
import { simulateGame } from '../scoring/simulate'
import { finishedMatch, simulateLiveMatch, simulateMatch } from './simulateMatch'
import { sampleTeams } from './testUtils'
import type { MatchTeams, Side } from './types'

const teams = sampleTeams(3)
const SEED = 77
const GAMES: MiniGameId[] = ['duel', 'smite', 'gank']
const script = liveEvents(SEED, GAMES)
const winners: Side[] = ['red', 'blue', 'red']
const scriptWith = (count: number) => ({ events: script, winners: winners.slice(0, count) })

describe('simulateLiveMatch', () => {
  it('plays the gank game first and the smite last', () => {
    expect(script.map(({ game }) => game)).toEqual(['gank', 'duel', 'smite'])
    expect(script.map(({ kind }) => kind)).toEqual(['gank', 'teamfight', script[2]?.late ? 'elder' : 'baron'])
  })

  it('pauses before the first live event until it has a winner', () => {
    const paused = simulateLiveMatch(teams, SEED, scriptWith(0))
    expect(paused.pendingEvent).toBe(0)
    expect(paused.winner).toBeNull()
    expect(paused.scripted).toEqual([])
    expect(paused.events.every(({ time }) => time < (script[1]?.time ?? 0))).toBe(true)
  })

  it('replays the same match up to the pause once the winner is known', () => {
    for (let count = 0; count < script.length; count++) {
      const before = simulateLiveMatch(teams, SEED, scriptWith(count))
      const after = simulateLiveMatch(teams, SEED, scriptWith(count + 1))
      expect(after.events.slice(0, before.events.length)).toEqual(before.events)
      expect(after.scripted.slice(0, count)).toEqual(before.scripted)
    }
  })

  it('gives every live event to the decided winner', () => {
    const match = simulateLiveMatch(teams, SEED, scriptWith(3))
    expect(match.pendingEvent).toBeNull()
    expect(match.scripted).toHaveLength(3)
    match.scripted.forEach((eventIndex, index) => {
      const event = match.events[eventIndex]
      expect(event?.kind).toBe(script[index]?.kind)
      expect(event?.side).toBe(winners[index])
      expect(event?.big).toBe(true)
      expect(event?.tags).not.toContain('steal')
    })
  })

  it('plays the gank in the scripted lane with the scripted jungler', () => {
    const match = simulateLiveMatch(teams, SEED, scriptWith(3))
    const gank = match.events[match.scripted[0] ?? -1]
    const { ganker, lane } = script[0] ?? { ganker: 'blue', lane: 'top' }
    expect(gank?.spot).toBe(lane)
    const jungler = gank?.side === ganker ? gank.actor : gank?.target
    expect(gank?.kills).toHaveLength(1)
    if (gank?.side !== ganker) expect(jungler).toEqual({ side: ganker, role: 'JUNGLE' })
  })

  it('never ends while the events left could still change who won the most', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const events = liveEvents(seed, ['duel', 'hook', 'combo'])
      const split = simulateLiveMatch(teams, seed, { events, winners: ['blue', 'red', 'blue'] })
      expect(split.scripted).toHaveLength(3)
      expect(split.events.length - 1).toBeGreaterThan(split.scripted[2] ?? Infinity)
      const sweep = simulateLiveMatch(teams, seed, { events, winners: ['blue', 'blue', 'blue'] })
      expect(sweep.winner).not.toBeNull()
      expect(sweep.scripted.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('can end early once the events are decided', () => {
    const early = Array.from({ length: 150 }, (_, seed) => {
      const events = liveEvents(seed, ['duel', 'hook', 'combo'])
      return simulateLiveMatch(teams, seed, { events, winners: ['blue', 'blue', 'blue'] })
    }).filter(({ scripted }) => scripted.length < 3)
    expect(early.length).toBeGreaterThan(0)
  })

  it('gives the same result as a normal match once finished', () => {
    expect(finishedMatch(simulateLiveMatch(teams, SEED, scriptWith(3)))?.winner).toBeDefined()
    expect(finishedMatch(simulateLiveMatch(teams, SEED, scriptWith(1)))).toBeNull()
  })

  it('leaves matches without live events unchanged', () => {
    const live = finishedMatch(simulateLiveMatch(teams, SEED, { events: [], winners: [] }))
    expect(live).toEqual(simulateMatch(teams, SEED))
  })
})

describe('live event balance', { timeout: 120_000 }, () => {
  const random = seededRandom(9)
  const pool: TeamRating[] = Array.from({ length: 200 }, (_, index) =>
    rateTeam(simulateGame(gameData, index % 2 === 0 ? 'sensible' : 'random', random)),
  )
  const pair = (): MatchTeams => ({
    blue: { name: 'Blue', rating: pool[Math.floor(random() * pool.length)] as TeamRating },
    red: { name: 'Red', rating: pool[Math.floor(random() * pool.length)] as TeamRating },
  })
  const THREE: MiniGameId[] = ['gank', 'duel', 'smite']
  const FIVE: MiniGameId[] = ['gank', 'duel', 'hook', 'combo', 'smite']

  /** Blue's win rate when blue wins `blueEvents` of the events, in a random order. */
  function blueWinRate(games: MiniGameId[], blueEvents: number, filter: (teams: MatchTeams) => boolean, count = 800): number {
    let played = 0
    let won = 0
    for (let seed = 1; played < count; seed++) {
      const matchTeams = pair()
      if (!filter(matchTeams)) continue
      const order = [...Array<Side>(blueEvents).fill('blue'), ...Array<Side>(games.length - blueEvents).fill('red')].sort(
        () => random() - 0.5,
      )
      const match = simulateLiveMatch(matchTeams, seed, { events: liveEvents(seed, games), winners: order })
      played += 1
      if (match.winner === 'blue') won += 1
    }
    return won / played
  }

  const close = ({ blue, red }: MatchTeams) => Math.abs(blue.rating.score - red.rating.score) <= 3
  const muchBetter = ({ blue, red }: MatchTeams) => blue.rating.score - red.rating.score >= 15

  it('makes the mini-games decide close matches, with 3 or 5 events', () => {
    const three = [0, 1, 2, 3].map((events) => blueWinRate(THREE, events, close))
    expect(three[3]).toBeGreaterThan(0.9)
    expect(three[2]).toBeGreaterThan(0.7)
    expect(three[1]).toBeLessThan(0.3)
    expect(three[0]).toBeLessThan(0.1)
    const five = [2, 3, 5].map((events) => blueWinRate(FIVE, events, close))
    expect(five[0]).toBeLessThan(0.4)
    expect(five[1]).toBeGreaterThan(0.6)
    expect(five[2]).toBeGreaterThan(0.9)
  })

  it('keeps the draft important: a much better team losing every event is about a coin flip', () => {
    const losesAllThree = blueWinRate(THREE, 0, muchBetter, 500)
    const losesAllFive = blueWinRate(FIVE, 0, muchBetter, 500)
    expect(losesAllThree).toBeGreaterThan(0.35)
    expect(losesAllThree).toBeLessThan(0.65)
    // 3 or 5 events weigh about the same in total.
    expect(Math.abs(losesAllThree - losesAllFive)).toBeLessThan(0.15)
    expect(blueWinRate(THREE, 1, muchBetter, 500)).toBeGreaterThan(0.7)
  })
})
