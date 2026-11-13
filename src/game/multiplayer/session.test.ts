import { describe, expect, it } from 'vitest'
import { drawTimes, NO_SHOT } from '../minigames/duel'
import { MINI_GAME_RULES } from '../minigames/registry'
import { seededRandom } from '../random'
import { eventSetup, liveEvents } from './liveEvents'
import { lobbyPlayers, parsePresence, parseRoomMessage, type PlayerStatus, type PresenceInfo, type RoomMessage } from './protocol'
import {
  decidedWinners,
  eventStart,
  hostMessages,
  mergeRounds,
  roundEvents,
  roundReducer,
  shiftRound,
  sideOf,
  TIMINGS,
  type HostContext,
  type RoundState,
} from './session'
import { defaultSettings, type LobbySettings } from './settings'
import type { EncodedTeam } from './teamCode'

const HOST = 'host-id'
const GUEST = 'guest-id'
const ROUND = 'round-1'
const SEED = 12
const teamA: EncodedTeam = [{ role: 'TOP', champion: 'Garen', items: ['1', '2'] }]
const teamB: EncodedTeam = [{ role: 'TOP', champion: 'Darius', items: ['3', '4'] }]
const randomTeam = (): EncodedTeam => [{ role: 'MIDDLE', champion: 'Ahri', items: ['5', '6'] }]
const settings: LobbySettings = { ...defaultSettings(seededRandom(1)), games: ['duel', 'gank', 'hook'] }

const startDraft: RoomMessage = {
  type: 'startDraft',
  round: ROUND,
  seconds: 90,
  players: [
    { id: HOST, name: 'Team A' },
    { id: GUEST, name: 'Team B' },
  ],
  settings,
}
const startMatch: RoomMessage = { type: 'startMatch', round: ROUND, seed: SEED, teams: [teamA, teamB] }
const arrived = (event: number, player: string): RoomMessage => ({ type: 'arrived', round: ROUND, event, player })
const ready = (event: number, player: string): RoomMessage => ({ type: 'eventReady', round: ROUND, event, player })
const move = (event: number, player: string, step: number, value: number): RoomMessage => ({
  type: 'move',
  round: ROUND,
  event,
  player,
  step,
  value,
})

function play(messages: RoomMessage[], at = 0, from: RoundState | null = null): RoundState {
  const round = messages.reduce<RoundState | null>((state, message) => roundReducer(state, message, at), from)
  if (!round) throw new Error('No round')
  return round
}

const context = (overrides: Partial<HostContext> = {}): HostContext => ({
  now: 0,
  online: [HOST, GUEST],
  goneSince: {},
  random: seededRandom(1),
  randomTeam,
  ...overrides,
})

/** The order of play: the gank first, then the rest. */
const events = liveEvents(SEED, settings.games)
const gankIndex = events.findIndex(({ game }) => game === 'gank')
const duelIndex = events.findIndex(({ game }) => game === 'duel')

describe('roundReducer', () => {
  it('starts a round with the host on blue side and one event per chosen game', () => {
    const round = play([startDraft])
    expect(sideOf(round, HOST)).toBe('blue')
    expect(sideOf(round, GUEST)).toBe('red')
    expect(round.events).toHaveLength(3)
    expect(round.settings).toEqual(settings)
  })

  it('keeps the first team a player sends and ignores strangers', () => {
    const round = play([
      startDraft,
      { type: 'team', round: ROUND, player: HOST, team: teamA },
      { type: 'team', round: ROUND, player: HOST, team: teamB },
      { type: 'team', round: ROUND, player: 'stranger', team: teamB },
    ])
    expect(round.teams).toEqual({ [HOST]: teamA })
  })

  it('ignores messages from another round', () => {
    const round = play([startDraft, { type: 'team', round: 'old-round', player: HOST, team: teamA }])
    expect(round.teams).toEqual({})
  })

  it('stores each player’s moves by player, the first move per step only', () => {
    const round = play([startDraft, startMatch, move(0, GUEST, 0, 4), move(0, GUEST, 0, 9), move(0, HOST, 1, 7), move(0, 'stranger', 0, 1)])
    expect(round.events[0]?.moves).toEqual([[undefined, 7], [4]])
  })

  it('starts the game once both pressed Ready', () => {
    const one = play([startDraft, startMatch, arrived(0, HOST), ready(0, HOST)], 1000)
    expect(one.events[0]?.readyAt).toBeNull()
    expect(eventStart(one.events[0] ?? { openedAt: null, readyAt: null })).toBe(1000 + TIMINGS.intro * 1000)
    const both = play([ready(0, GUEST)], 4000, one)
    expect(both.events[0]?.readyAt).toBe(4000)
    expect(eventStart(both.events[0] ?? { openedAt: null, readyAt: null })).toBe(4000)
  })

  it('lists the decided winners in order, stopping at the first open event', () => {
    const round = play([
      startDraft,
      startMatch,
      { type: 'eventResult', round: ROUND, event: 0, result: { winner: 'red', scores: { blue: 0, red: 1 }, tie: false } },
      { type: 'eventResult', round: ROUND, event: 2, result: { winner: 'blue', scores: { blue: 1, red: 0 }, tie: false } },
    ])
    expect(decidedWinners(round)).toEqual(['red'])
  })

  it('knows the games of the match in order of play', () => {
    expect(roundEvents(play([startDraft]))).toEqual([])
    expect(roundEvents(play([startDraft, startMatch])).map(({ game }) => game)[0]).toBe('gank')
  })
})

describe('hostMessages: draft', () => {
  it('starts the match once both teams are in', () => {
    const round = play([
      startDraft,
      { type: 'team', round: ROUND, player: HOST, team: teamA },
      { type: 'team', round: ROUND, player: GUEST, team: teamB },
    ])
    expect(hostMessages(round, context())[0]).toMatchObject({ type: 'startMatch', teams: [teamA, teamB] })
  })

  it('waits for a connected player while the draft timer runs', () => {
    const round = play([startDraft, { type: 'team', round: ROUND, player: HOST, team: teamA }])
    expect(hostMessages(round, context({ now: 30_000 }))).toEqual([])
  })

  it('drafts a random team for a player who ran out of time or left', () => {
    const round = play([startDraft, { type: 'team', round: ROUND, player: HOST, team: teamA }])
    const timeUp = (90 + TIMINGS.draftGrace) * 1000
    expect(hostMessages(round, context({ now: timeUp }))[0]).toMatchObject({ teams: [teamA, randomTeam()] })
    expect(hostMessages(round, context({ online: [HOST] }))[0]).toMatchObject({ teams: [teamA, randomTeam()] })
  })
})

describe('hostMessages: live events', () => {
  const duelSetup = eventSetup(SEED, duelIndex, false, settings.bothRoles)
  const opened = (index: number) => play([startDraft, startMatch, arrived(index, HOST)])
  const settledBefore = (index: number) =>
    Array.from({ length: index }, (_, event): RoomMessage => ({
      type: 'eventResult',
      round: ROUND,
      event,
      result: { winner: 'blue', scores: { blue: 1, red: 0 }, tie: false },
    }))

  it('does nothing until a player reaches the event', () => {
    expect(hostMessages(play([startDraft, startMatch]), context())).toEqual([])
  })

  it('settles a mini-game once its moves decide it, with the scores by side', () => {
    const duelRules = MINI_GAME_RULES.duel
    // The host shoots 200 ms after DRAW twice; the guest never shoots.
    const [first, second] = drawTimes(duelSetup.seed).map((drawAt) => drawAt + 200)
    const round = play(
      [
        ...settledBefore(duelIndex),
        arrived(duelIndex, HOST),
        move(duelIndex, HOST, 0, first ?? 0),
        move(duelIndex, GUEST, 0, NO_SHOT),
        move(duelIndex, HOST, 1, second ?? 0),
        move(duelIndex, GUEST, 1, NO_SHOT),
      ],
      0,
      play([startDraft, startMatch]),
    )
    const settled = duelRules.settle(round.events[duelIndex]?.moves ?? [[], []], duelSetup)
    expect(settled).not.toBeNull()
    const [message] = hostMessages(round, context())
    expect(message).toMatchObject({ type: 'eventResult', event: duelIndex, result: { winner: 'blue', tie: false } })
    if (message?.type === 'eventResult' && settled) {
      expect(message.result.scores).toEqual({ blue: settled.scores[0], red: settled.scores[1] })
      expect(message.result.winner).toBe(settled.winner === 0 ? 'blue' : 'red')
    }
  })

  it('fills in poor moves once the time limit has passed', () => {
    const round = opened(gankIndex)
    expect(hostMessages(round, context({ now: 1000 }))).toEqual([])
    const gankSetup = eventSetup(SEED, gankIndex, false, settings.bothRoles)
    const limit = (TIMINGS.intro + TIMINGS.opening + MINI_GAME_RULES.gank.liveSeconds(gankSetup) + TIMINGS.eventGrace) * 1000
    const [message] = hostMessages(round, context({ now: limit }))
    expect(message).toMatchObject({ type: 'move', event: gankIndex, step: 0, value: 1 })
  })

  it('fills in moves at once for a player who is gone, but not for a short blip', () => {
    const round = play([ready(gankIndex, HOST), ready(gankIndex, GUEST)], 0, opened(gankIndex))
    const blip = hostMessages(round, context({ now: 1000, online: [HOST], goneSince: { [GUEST]: 500 } }))
    const gone = hostMessages(round, context({ now: 5000, online: [HOST], goneSince: { [GUEST]: 500 } }))
    const hider = firstHider(round)
    expect(blip).toEqual([])
    if (hider === GUEST) expect(gone[0]).toMatchObject({ type: 'move', player: GUEST })
    else expect(gone).toEqual([])
  })

  it('surrenders for a player gone for 30 seconds', () => {
    const round = opened(0)
    expect(hostMessages(round, context({ now: 20_000, goneSince: { [GUEST]: 0 } }))[0]?.type).not.toBe('surrender')
    expect(hostMessages(round, context({ now: TIMINGS.gone * 1000, goneSince: { [GUEST]: 0 } }))).toEqual([
      { type: 'surrender', round: ROUND, player: GUEST },
    ])
  })

  it('stops settling anything once a player surrendered', () => {
    const round = play([{ type: 'surrender', round: ROUND, player: GUEST }], 0, opened(0))
    expect(round.surrendered).toBe(GUEST)
    expect(hostMessages(round, context({ now: 999_999 }))).toEqual([])
  })
})

/** Who hides first in the gank game of this match. */
function firstHider(round: RoundState): string {
  const setup = eventSetup(SEED, gankIndex, false, settings.bothRoles)
  const owed = MINI_GAME_RULES.gank.owed([[], []], setup)[0]
  return round.players[owed?.player ?? 0]?.id ?? ''
}

describe('parseRoomMessage', () => {
  it('accepts every valid message', () => {
    const messages: RoomMessage[] = [startDraft, startMatch, arrived(2, HOST), ready(2, GUEST), move(1, HOST, 3, 60_000)]
    for (const message of messages) expect(parseRoomMessage(JSON.parse(JSON.stringify(message)))).toEqual(message)
    expect(parseRoomMessage({ type: 'emote', player: HOST, emote: 'GG' })).not.toBeNull()
  })

  it('drops malformed messages', () => {
    expect(parseRoomMessage(null)).toBeNull()
    expect(parseRoomMessage({ type: 'hack' })).toBeNull()
    expect(parseRoomMessage({ ...move(1, HOST, 0, 5), value: -1 })).toBeNull()
    expect(parseRoomMessage({ ...move(1, HOST, 0, 5), value: 1.5 })).toBeNull()
    expect(parseRoomMessage({ ...move(1, HOST, 0, 5), step: 999 })).toBeNull()
    expect(parseRoomMessage({ ...startDraft, settings: { ...settings, games: ['duel', 'nope'] } })).toBeNull()
    expect(parseRoomMessage({ type: 'emote', player: HOST, emote: '<script>' })).toBeNull()
  })
})

describe('lobbyPlayers, presence and status', () => {
  const present = (id: string, joinedAt: number): PresenceInfo => ({ id, joinedAt })
  const status: PlayerStatus = { name: 'Team A', ready: true, playing: false, settings }

  it('puts the earliest player first as the host and leaves out a third', () => {
    expect(lobbyPlayers([present('c', 3), present('a', 1), present('b', 2)]).map(({ id }) => id)).toEqual(['a', 'b'])
  })

  it('counts a player connected twice (a reload) once', () => {
    expect(lobbyPlayers([present('a', 1), present('b', 2), present('a', 1)]).map(({ id }) => id)).toEqual(['a', 'b'])
  })

  it('shows each player with their latest status, or as joining until it arrives', () => {
    const [a, b] = lobbyPlayers([present('a', 1), present('b', 2)], { a: status })
    expect(a).toEqual({ id: 'a', joinedAt: 1, ...status })
    expect(b).toMatchObject({ id: 'b', ready: false, playing: false })
  })

  it('parses presence: only who is connected and since when', () => {
    expect(parsePresence({ ...present('a', 1), presence_ref: 'x' })).toEqual(present('a', 1))
    expect(parsePresence({ id: 'a' })).toBeNull()
  })

  it('parses a status, dropping settings it does not understand but keeping the player', () => {
    const message = { type: 'status', player: HOST, status, hello: true }
    expect(parseRoomMessage(JSON.parse(JSON.stringify(message)))).toEqual(message)
    const odd = parseRoomMessage({ ...message, status: { ...status, settings: { pace: 'warp' } } })
    expect(odd?.type === 'status' && odd.status).toEqual({ name: 'Team A', ready: true, playing: false })
    expect(parseRoomMessage({ ...message, status: { name: 'x' } })).toBeNull()
  })
})

describe('sync after a reconnect', () => {
  const result = { winner: 'blue' as const, scores: { blue: 1, red: 0 }, tie: false }
  const full = play(
    [
      startDraft,
      { type: 'team', round: ROUND, player: HOST, team: teamA },
      { type: 'team', round: ROUND, player: GUEST, team: teamB },
      startMatch,
      arrived(0, HOST),
      ready(0, HOST),
      ready(0, GUEST),
      move(0, HOST, 0, 3),
      move(0, GUEST, 0, 1),
      { type: 'eventResult', round: ROUND, event: 0, result },
      arrived(1, GUEST),
      move(1, GUEST, 1, 9),
    ],
    5000,
  )

  it('sends a whole round over the network and reads it back the same', () => {
    const message: RoomMessage = { type: 'sync', to: GUEST, sentAt: 123, state: full }
    expect(parseRoomMessage(JSON.parse(JSON.stringify(message)))).toEqual(message)
  })

  it('drops a broken round', () => {
    const broken = { type: 'sync', to: GUEST, sentAt: 1, state: { ...full, events: [] } }
    expect(parseRoomMessage(JSON.parse(JSON.stringify(broken)))).toBeNull()
    const badMove = { ...full, events: full.events.map((event) => ({ ...event, moves: [[-4], []] })) }
    expect(parseRoomMessage({ type: 'sync', to: GUEST, sentAt: 1, state: badMove })).toBeNull()
  })

  it('moves every time onto the local clock', () => {
    const shifted = shiftRound(full, 1000)
    expect(shifted.startedAt).toBe(6000)
    expect(shifted.match?.startedAt).toBe(6000)
    expect(shifted.events[0]).toMatchObject({ openedAt: 6000, readyAt: 6000 })
    expect(shifted.events[2]).toMatchObject({ openedAt: null, readyAt: null })
  })

  it('adds what was missed and keeps what this player already had', () => {
    const missed = play([startDraft, { type: 'team', round: ROUND, player: HOST, team: teamA }, move(1, HOST, 0, 2)], 9000)
    const merged = mergeRounds(missed, full)
    expect(merged.teams).toEqual({ [HOST]: teamA, [GUEST]: teamB })
    expect(merged.match).toEqual(full.match)
    expect(merged.startedAt).toBe(9000)
    expect(merged.events[0]?.result).toEqual(result)
    expect(merged.events[1]?.moves).toEqual([[2], [undefined, 9]])
    expect(merged.events[1]?.arrived).toEqual([GUEST])
    expect(mergeRounds(full, play([startDraft], 9000))).toEqual(full)
  })

  it('never merges two different rounds', () => {
    const other = play([{ ...startDraft, round: 'round-2' }])
    expect(mergeRounds(other, full)).toBe(other)
  })
})
