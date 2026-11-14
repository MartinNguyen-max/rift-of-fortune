import { describe, expect, it } from 'vitest'
import {
  BOT_PARANOIA,
  CALL_CAP_MS,
  callMove,
  callOpensMs,
  flightOfStep,
  formatParanoiaScore,
  NO_CALL,
  paranoiaCalls,
  paranoiaFlight,
  PARANOIA_ROUNDS,
  PARANOIA_RULES,
  paranoiaScore,
  pointAlong,
  readCall,
  SCORE_BASE,
  type CallResult,
} from './paranoia'
import { LANE_SPOTS } from './riftLanes'
import { botMoves, soloSetup, type GameSetup, type Moves } from './versus'

const live: GameSetup = { seed: 21, variant: 'live', bothRoles: false, late: false }
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

describe('Paranoia flights', () => {
  it('are the same for the same seed and end in the lane he lands in', () => {
    expect(paranoiaFlight(5, 1)).toEqual(paranoiaFlight(5, 1))
    for (let seed = 1; seed <= 200; seed++) {
      const flight = paranoiaFlight(seed, seed % 3)
      expect(flight.path[flight.path.length - 1]).toEqual(LANE_SPOTS[flight.lane])
      expect(flight.fake).not.toBe(flight.lane)
      expect(flight.flickers).toHaveLength(PARANOIA_ROUNDS[seed % 3]?.flickers ?? 0)
    }
  })

  it('gets darker each round: fewer, shorter flickers and more fake-outs', () => {
    const fakes = [0, 1, 2].map((round) => {
      let count = 0
      for (let seed = 1; seed <= 400; seed++) if (paranoiaFlight(seed, round).fake !== null) count += 1
      return count / 400
    })
    expect(fakes[0]).toBeLessThan(fakes[1] ?? 0)
    expect(fakes[1]).toBeLessThan(fakes[2] ?? 0)
    const flights = [0, 1, 2].map((round) => paranoiaFlight(9, round))
    expect(flights.map(({ flickerMs }) => flickerMs)).toEqual([...flights.map(({ flickerMs }) => flickerMs)].sort((a, b) => b - a))
  })

  it('always shows him at least once after a fake-out turn', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const flight = paranoiaFlight(seed, 2)
      const turn = flight.path[1]
      if (flight.fake === null || !turn) continue
      const [start] = flight.path
      const last = flight.flickers[flight.flickers.length - 1]
      if (!start || !last) throw new Error('No flight')
      // Past the turn: further along than the turn is from the start.
      expect(distance(start, last) > distance(start, turn) || distance(last, turn) > 1).toBe(true)
      expect(distance(last, LANE_SPOTS[flight.lane])).toBeLessThan(distance(turn, LANE_SPOTS[flight.lane]))
    }
  })

  it('walks a path by share of its length', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]
    expect(pointAlong(path, 0)).toEqual({ x: 0, y: 0 })
    expect(pointAlong(path, 0.25)).toEqual({ x: 5, y: 0 })
    expect(pointAlong(path, 0.75)).toEqual({ x: 10, y: 5 })
    expect(pointAlong(path, 1)).toEqual({ x: 10, y: 10 })
  })

  it('opens the call after the last flicker, later in the first round', () => {
    const flight = flightOfStep(live, 0)
    expect(callOpensMs(flight, 0)).toBeGreaterThan(callOpensMs(flight, 1))
  })
})

describe('Paranoia calls and scores', () => {
  it('packs a call into one move and back', () => {
    expect(readCall(callMove(2, 834))).toEqual({ lane: 2, ms: 834 })
    expect(readCall(NO_CALL)).toEqual({ lane: null, ms: CALL_CAP_MS })
    expect(readCall(callMove(0, 99_999)).ms).toBe(CALL_CAP_MS)
  })

  it('counts right calls first, then the faster ones', () => {
    const call = (right: boolean, ms: number): CallResult => ({ lane: 0, ms, right })
    expect(paranoiaScore([call(true, 900), call(true, 900)])).toBeGreaterThan(paranoiaScore([call(true, 100), call(false, 100)]))
    expect(paranoiaScore([call(true, 700)])).toBeGreaterThan(paranoiaScore([call(true, 800)]))
    expect(paranoiaScore([call(false, 100)])).toBe(0)
    expect(formatParanoiaScore(paranoiaScore([call(true, 600), call(true, 800), call(false, 50)]))).toBe('2/3 · 1.4 s')
    expect(formatParanoiaScore(0)).toBe('0/3')
    expect(Math.floor(paranoiaScore([call(true, 1)]) / SCORE_BASE)).toBe(1)
  })

  it('settles once both called every round, with ties', () => {
    const right = (step: number, ms: number) => callMove(flightOfStep(live, step).lane, ms)
    const all = (ms: number): Moves => [0, 1, 2].map((step) => right(step, ms))
    expect(PARANOIA_RULES.settle([all(500), [right(0, 500)]], live)).toBeNull()
    expect(PARANOIA_RULES.settle([all(500), all(600)], live)?.winner).toBe(0)
    expect(PARANOIA_RULES.settle([all(500), all(500)], live)?.winner).toBeNull()
    expect(PARANOIA_RULES.settle([[NO_CALL, NO_CALL, NO_CALL], all(2900)], live)?.winner).toBe(1)
  })

  it('reads each call against the round’s lane', () => {
    const lane = flightOfStep(live, 0).lane
    const nextLane = flightOfStep(live, 1).lane
    const wrong = nextLane === 0 ? 1 : 0
    const [mine] = paranoiaCalls([[callMove(lane, 400), callMove(wrong, 300)], []], live)
    expect(mine.map(({ right }) => right)).toEqual([true, false])
  })

  it('owes each player their next call, and fills in no call', () => {
    expect(PARANOIA_RULES.owed([[1], []], live)).toEqual([
      { player: 0, step: 1 },
      { player: 1, step: 0 },
    ])
    expect(PARANOIA_RULES.fallback({ player: 0, step: 0 }, [[], []], live)).toBe(NO_CALL)
  })

  it('keeps your right calls (then speed) as the personal best', () => {
    const setup = soloSetup(4)
    const mine: Moves = [0, 1, 2].map((step) => callMove(flightOfStep(setup, step).lane, 500))
    const bot = botMoves(PARANOIA_RULES, mine, setup)
    expect(PARANOIA_RULES.best?.of([mine, bot], setup)).toBe(paranoiaScore(paranoiaCalls([mine, bot], setup)[0]))
    expect(PARANOIA_RULES.best?.format(3 * SCORE_BASE + SCORE_BASE - 1 - 1500)).toBe('3/3 · 1.5 s')
  })

  it('fits the three rounds in the Multiplayer time limit', () => {
    expect(PARANOIA_RULES.liveSeconds(live)).toBeGreaterThan(20)
    expect(PARANOIA_RULES.liveSeconds(live)).toBeLessThan(45)
  })
})

describe('Paranoia bot (Ekko)', () => {
  it('gets fewer right as the rounds get darker, about 1.6–2 a game', () => {
    const right = [0, 0, 0]
    const games = 2000
    for (let seed = 1; seed <= games; seed++) {
      const setup = soloSetup(seed)
      const bot = botMoves(PARANOIA_RULES, [], setup)
      paranoiaCalls([[], bot], setup)[1].forEach((call, round) => {
        if (call.right) right[round] = (right[round] ?? 0) + 1
      })
    }
    const share = right.map((count) => count / games)
    expect(share[0]).toBeGreaterThan(share[1] ?? 1)
    expect(share[1]).toBeGreaterThan(share[2] ?? 1)
    const perGame = share.reduce((total, value) => total + value, 0)
    expect(perGame).toBeGreaterThan(1.4)
    expect(perGame).toBeLessThan(2.2)
    expect(BOT_PARANOIA.callMs.min).toBeGreaterThan(300)
  })
})
