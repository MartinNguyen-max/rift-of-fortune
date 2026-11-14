import { describe, expect, it } from 'vitest'
import {
  botRun,
  closestRun,
  crashSeconds,
  holdDistance,
  holdFor,
  holdSpeed,
  NO_RUN,
  RACE,
  RACE_RULES,
  RACE_SCORE,
  raceTrack,
  raceWinner,
  runOutcome,
  runScore,
  trackOfRun,
  type RaceTrack,
  type RunOutcome,
} from './race'
import { soloSetup, type BothMoves, type GameSetup } from './versus'

const track: RaceTrack = { target: 60, tower: 75, boost: 8, surge: 2.5 }
const live: GameSetup = { seed: 7, variant: 'live', bothRoles: false, late: false }

/** The hold (ms) that stops Sion `offset` meters from the target's middle. */
const holdTo = (at: RaceTrack, offset: number) => Math.round(holdFor(at, at.target + offset) * 1000)

describe('tracks', () => {
  it('puts the target in range and the tower behind it, sometimes close', () => {
    let near = 0
    for (let seed = 1; seed <= 300; seed++) {
      const { target, tower, boost, surge } = raceTrack(seed)
      expect(target).toBeGreaterThanOrEqual(RACE.target.min)
      expect(target).toBeLessThanOrEqual(RACE.target.max)
      const gap = tower - target
      expect(gap).toBeGreaterThanOrEqual(RACE.nearGap.min)
      expect(gap).toBeLessThanOrEqual(RACE.gap.max)
      if (gap < RACE.gap.min) near += 1
      expect(boost).toBeGreaterThan(0)
      expect(surge).toBeGreaterThan(0)
    }
    expect(near).toBeGreaterThan(30)
    expect(near).toBeLessThan(150)
  })

  it('gives both players the same three tracks, each different', () => {
    const tracks = [0, 1, 2].map((run) => trackOfRun(live, run))
    expect(tracks).toEqual([0, 1, 2].map((run) => trackOfRun({ ...live }, run)))
    expect(new Set(tracks.map(({ target }) => target)).size).toBe(3)
  })
})

describe('the charge and the slide', () => {
  it('speeds up faster and faster while held', () => {
    expect(holdSpeed(track, 2) - holdSpeed(track, 1)).toBeGreaterThan(holdSpeed(track, 1) - holdSpeed(track, 0))
    expect(holdDistance(track, 0)).toBe(0)
  })

  it('slides further the longer you hold: speed squared over twice the braking', () => {
    const speed = holdSpeed(track, 2)
    const expected = holdDistance(track, 2) + (speed * speed) / (2 * RACE.brake)
    expect(runOutcome(track, 2000).stop).toBeCloseTo(expected)
    expect(runOutcome(track, 2100).stop).toBeGreaterThan(runOutcome(track, 2000).stop)
  })

  it('crashes into the tower when the slide reaches it, or when you never let go', () => {
    const crash = runOutcome(track, holdTo(track, 20))
    expect(crash).toMatchObject({ crashed: true, score: 0, stop: track.tower })
    expect(runOutcome(track, RACE.maxHoldSeconds * 1000).crashed).toBe(true)
    expect(holdDistance(track, crashSeconds(track))).toBeCloseTo(track.tower, 1)
  })

  it('stays at the start without a run', () => {
    expect(runOutcome(track, NO_RUN)).toMatchObject({ stop: 0, crashed: false, score: 0 })
  })

  it('finds the hold that stops on a spot', () => {
    expect(runOutcome(track, holdTo(track, 0)).offset).toBeCloseTo(0, 0)
    expect(runOutcome(track, holdTo(track, -8)).offset).toBeCloseTo(-8, 0)
  })
})

describe('scoring', () => {
  it('gives 100 near the middle and 5 less for every meter further', () => {
    expect(runScore(0)).toBe(100)
    expect(runScore(RACE_SCORE.perfect)).toBe(100)
    expect(runScore(RACE_SCORE.perfect + 4)).toBe(80)
    expect(runScore(30)).toBe(0)
  })

  it('scores short and long stops the same way, and a crash 0', () => {
    // Holds are whole ms, so the two stops can be a few centimeters apart.
    expect(Math.abs(runOutcome(track, holdTo(track, -10)).score - runOutcome(track, holdTo(track, 10)).score)).toBeLessThanOrEqual(1)
    expect(runOutcome(track, holdTo(track, 14)).score).toBeGreaterThan(0)
    expect(runOutcome(track, holdTo(track, 16)).score).toBe(0)
  })

  const outcome = (score: number, offset: number, crashed = false): RunOutcome => ({
    stop: 0,
    crashed,
    offset,
    score,
    holdSeconds: 0,
    slideSeconds: 0,
  })

  it('goes to the most points, then the closest single run', () => {
    expect(raceWinner([outcome(90, 3), outcome(80, 5)], [outcome(100, 0), outcome(60, 9)])).toBe(0)
    expect(raceWinner([outcome(90, 3), outcome(80, 5)], [outcome(100, 1), outcome(70, 7)])).toBe(1)
    expect(raceWinner([outcome(90, 3)], [outcome(90, -3)])).toBeNull()
  })

  it('leaves crashes out of the closest run', () => {
    expect(closestRun([outcome(0, 0, true), outcome(60, -9)])).toBe(9)
    expect(closestRun([outcome(0, 0, true)])).toBe(Infinity)
  })
})

describe('RACE_RULES', () => {
  it('settles once both ran all three tracks', () => {
    const holds = [0, 1, 2].map((run) => holdTo(trackOfRun(live, run), 0))
    const short = [0, 1, 2].map((run) => holdTo(trackOfRun(live, run), -10))
    expect(RACE_RULES.settle([holds, short.slice(0, 2)], live)).toBeNull()
    const settled = RACE_RULES.settle([holds, short], live)
    expect(settled).toMatchObject({ winner: 0, scores: [300, expect.any(Number)] })
    expect(settled?.scores[1]).toBeGreaterThan(160)
    expect(settled?.scores[1]).toBeLessThan(185)
  })

  it('owes each player their next run', () => {
    expect(RACE_RULES.owed([[], [2000]], live)).toEqual([
      { player: 0, step: 0 },
      { player: 1, step: 1 },
    ])
    expect(RACE_RULES.owed([[1, 1, 1], [1, 1, 1]], live)).toEqual([])
  })

  it('fills in a run that never started, which scores 0', () => {
    const value = RACE_RULES.fallback({ player: 0, step: 0 }, [[], []], live)
    expect(runOutcome(trackOfRun(live, 0), value).score).toBe(0)
  })

  it('keeps your points as the personal best', () => {
    const setup = soloSetup(3)
    const moves: BothMoves = [[0, 1, 2].map((run) => holdTo(trackOfRun(setup, run), 0)), [NO_RUN, NO_RUN, NO_RUN]]
    expect(RACE_RULES.best?.of(moves, setup)).toBe(300)
    expect(RACE_RULES.formatScore(1, setup)).toBe('1 pt')
    expect(RACE_RULES.formatScore(245, setup)).toBe('245 pts')
  })

  it('fits three runs in the Multiplayer time limit', () => {
    expect(RACE_RULES.liveSeconds(live)).toBeGreaterThanOrEqual(RACE.runs * (3 + RACE.startSeconds + RACE.maxHoldSeconds))
  })
})

describe('Vi, the bot', () => {
  it('is good but beatable: mostly near the middle, sometimes short, sometimes crashing', () => {
    const scores: number[] = []
    let crashes = 0
    for (let seed = 1; seed <= 2000; seed++) {
      const at = raceTrack(seed)
      const result = runOutcome(at, botRun(at, seed * 13))
      scores.push(result.score)
      if (result.crashed) crashes += 1
    }
    const average = scores.reduce((total, score) => total + score, 0) / scores.length
    expect(average).toBeGreaterThan(65)
    expect(average).toBeLessThan(90)
    expect(crashes / scores.length).toBeGreaterThan(0.02)
    expect(crashes / scores.length).toBeLessThan(0.12)
  })

  it('runs every track once, and is the same for the same seed', () => {
    const setup = soloSetup(9)
    expect(RACE_RULES.botMove(0, [[], []], setup)).toBe(RACE_RULES.botMove(0, [[], []], setup))
    expect(RACE_RULES.botMove(RACE.runs, [[], []], setup)).toBeUndefined()
  })
})
