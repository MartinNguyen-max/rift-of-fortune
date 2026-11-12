import { describe, expect, it } from 'vitest'
import { gameData } from '../../data'
import { LIVE_EVENTS, liveScript } from '../multiplayer/liveEvents'
import { seededRandom } from '../random'
import { rateTeam, type TeamRating } from '../scoring/rateTeam'
import { simulateGame } from '../scoring/simulate'
import { finishedMatch, simulateLiveMatch, simulateMatch } from './simulateMatch'
import { sampleTeams } from './testUtils'
import type { MatchTeams, Side } from './types'

const teams = sampleTeams(3)
const SEED = 77
const script = liveScript(SEED)
const winners: Side[] = ['red', 'blue', 'red', 'blue']
const scriptWith = (count: number) => ({ events: script, winners: winners.slice(0, count) })

describe('simulateLiveMatch', () => {
  it('pauses before the first live event until it has a winner', () => {
    const paused = simulateLiveMatch(teams, SEED, scriptWith(0))
    expect(paused.pendingEvent).toBe(0)
    expect(paused.winner).toBeNull()
    expect(paused.scripted).toEqual([])
    expect(paused.events.every(({ time }) => time < LIVE_EVENTS[1].time)).toBe(true)
  })

  it('replays the same match up to the pause once the winner is known', () => {
    for (let count = 0; count < LIVE_EVENTS.length; count++) {
      const before = simulateLiveMatch(teams, SEED, scriptWith(count))
      const after = simulateLiveMatch(teams, SEED, scriptWith(count + 1))
      expect(after.events.slice(0, before.events.length)).toEqual(before.events)
      expect(after.scripted.slice(0, count)).toEqual(before.scripted)
    }
  })

  it('gives every live event to the decided winner', () => {
    const match = simulateLiveMatch(teams, SEED, scriptWith(4))
    expect(match.pendingEvent).toBeNull()
    expect(match.scripted).toHaveLength(4)
    match.scripted.forEach((eventIndex, index) => {
      const event = match.events[eventIndex]
      expect(event?.kind).toBe(LIVE_EVENTS[index]?.kind)
      expect(event?.side).toBe(winners[index])
      expect(event?.big).toBe(true)
      expect(event?.tags).not.toContain('steal')
    })
  })

  it('plays the gank in the scripted lane with the scripted jungler', () => {
    const match = simulateLiveMatch(teams, SEED, scriptWith(4))
    const gank = match.events[match.scripted[0] ?? -1]
    const { ganker, lane } = script[0] ?? { ganker: 'blue', lane: 'top' }
    expect(gank?.spot).toBe(lane)
    // The ganker either lands the kill or dies to the defender's guess.
    const jungler = gank?.side === ganker ? gank.actor : gank?.target
    expect(gank?.kills).toHaveLength(1)
    if (gank?.side !== ganker) expect(jungler).toEqual({ side: ganker, role: 'JUNGLE' })
  })

  it('never ends before the last live event', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const match = simulateLiveMatch(teams, seed, { events: liveScript(seed), winners: ['blue', 'blue', 'blue', 'blue'] })
      expect(match.winner).not.toBeNull()
      expect(match.scripted).toHaveLength(4)
      const lastLive = match.scripted[3] ?? Infinity
      expect(match.events.length - 1).toBeGreaterThan(lastLive)
    }
  })

  it('gives the same result as a normal match once finished', () => {
    const match = finishedMatch(simulateLiveMatch(teams, SEED, scriptWith(4)))
    expect(match?.winner).toBeDefined()
    expect(finishedMatch(simulateLiveMatch(teams, SEED, scriptWith(2)))).toBeNull()
  })

  it('leaves matches without live events unchanged', () => {
    const live = finishedMatch(simulateLiveMatch(teams, SEED, { events: [], winners: [] }))
    expect(live).toEqual(simulateMatch(teams, SEED))
  })
})

describe('live event balance', () => {
  const random = seededRandom(9)
  const pool: TeamRating[] = Array.from({ length: 200 }, (_, index) =>
    rateTeam(simulateGame(gameData, index % 2 === 0 ? 'sensible' : 'random', random)),
  )
  const pair = (): MatchTeams => ({
    blue: { name: 'Blue', rating: pool[Math.floor(random() * pool.length)] as TeamRating },
    red: { name: 'Red', rating: pool[Math.floor(random() * pool.length)] as TeamRating },
  })

  /** Blue's win rate when blue wins `blueEvents` of the four live events, in a random order. */
  function blueWinRate(blueEvents: number, filter: (teams: MatchTeams) => boolean, games = 1500): number {
    let played = 0
    let won = 0
    for (let seed = 1; played < games; seed++) {
      const matchTeams = pair()
      if (!filter(matchTeams)) continue
      const order = [...Array<Side>(blueEvents).fill('blue'), ...Array<Side>(4 - blueEvents).fill('red')].sort(
        () => random() - 0.5,
      )
      const match = simulateLiveMatch(matchTeams, seed, { events: liveScript(seed), winners: order })
      played += 1
      if (match.winner === 'blue') won += 1
    }
    return won / played
  }

  const close = ({ blue, red }: MatchTeams) => Math.abs(blue.rating.score - red.rating.score) <= 3
  const muchBetter = ({ blue, red }: MatchTeams) => blue.rating.score - red.rating.score >= 15

  it('makes the mini-games matter between equal teams', () => {
    const rates = [0, 1, 2, 3, 4].map((events) => blueWinRate(events, close, 800))
    expect(rates[2]).toBeGreaterThan(0.4)
    expect(rates[2]).toBeLessThan(0.6)
    expect(rates[4]).toBeGreaterThan(0.85)
    expect(rates[3]).toBeGreaterThan(rates[2] ?? 1)
  })

  it('keeps the draft important: a much better team still wins most even splits', () => {
    const even = blueWinRate(2, muchBetter, 800)
    const losesAll = blueWinRate(0, muchBetter, 800)
    expect(even).toBeGreaterThan(0.65)
    // About a coin flip: a great draft against someone who wins every mini-game.
    expect(losesAll).toBeLessThan(0.62)
    expect(losesAll).toBeGreaterThan(0.35)
  })
})
