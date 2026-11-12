import { describe, expect, it } from 'vitest'
import { seededRandom } from '../random'
import { LIVE_EVENTS, liveScript } from './liveEvents'
import { lobbyPlayers, parsePresence, parseRoomMessage, type PresenceInfo, type RoomMessage } from './protocol'
import { decidedWinners, hostMessages, roundReducer, sideOf, TIMINGS, type HostContext, type RoundState } from './session'
import type { EncodedTeam } from './teamCode'

const HOST = 'host-id'
const GUEST = 'guest-id'
const ROUND = 'round-1'
const teamA: EncodedTeam = [{ role: 'TOP', champion: 'Garen', items: ['1', '2'] }]
const teamB: EncodedTeam = [{ role: 'TOP', champion: 'Darius', items: ['3', '4'] }]
const randomTeam = (): EncodedTeam => [{ role: 'MIDDLE', champion: 'Ahri', items: ['5', '6'] }]

const startDraft: RoomMessage = {
  type: 'startDraft',
  round: ROUND,
  seconds: TIMINGS.draft,
  players: [
    { id: HOST, name: 'Team A' },
    { id: GUEST, name: 'Team B' },
  ],
}

function play(messages: RoomMessage[], at = 0): RoundState {
  const round = messages.reduce<RoundState | null>((state, message) => roundReducer(state, message, at), null)
  if (!round) throw new Error('No round')
  return round
}

const context = (overrides: Partial<HostContext> = {}): HostContext => ({
  now: 0,
  online: [HOST, GUEST],
  random: seededRandom(1),
  randomTeam,
  ...overrides,
})

const startMatch: RoomMessage = { type: 'startMatch', round: ROUND, seed: 12, teams: [teamA, teamB] }
const arrived = (event: number, player: string): RoomMessage => ({ type: 'arrived', round: ROUND, event, player })
const score = (event: number, player: string, value: number): RoomMessage => ({
  type: 'score',
  round: ROUND,
  event,
  player,
  score: value,
})

/** A round in the match, with the gank (event 0) already settled. */
function afterGank(): RoundState {
  return play([
    startDraft,
    startMatch,
    { type: 'eventResult', round: ROUND, event: 0, result: { winner: 'blue', scores: null, bush: 'top', guess: 'mid' } },
  ])
}

describe('roundReducer', () => {
  it('starts a round with the host on blue side', () => {
    const round = play([startDraft])
    expect(sideOf(round, HOST)).toBe('blue')
    expect(sideOf(round, GUEST)).toBe('red')
    expect(round.events).toHaveLength(LIVE_EVENTS.length)
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

  it('counts the first score of each player per event', () => {
    const round = play([startDraft, startMatch, score(1, HOST, 70), score(1, HOST, 100)])
    expect(round.events[1]?.scores).toEqual({ [HOST]: 70 })
  })

  it('only takes a guess after the jungler has hidden', () => {
    const early = play([startDraft, startMatch, { type: 'guess', round: ROUND, event: 0, bush: 'mid' }])
    expect(early.events[0]?.guess).toBeUndefined()
    const later = play([
      startDraft,
      startMatch,
      { type: 'hide', round: ROUND, event: 0, bush: 'bot' },
      { type: 'hide', round: ROUND, event: 0, bush: 'top' },
      { type: 'guess', round: ROUND, event: 0, bush: 'mid' },
    ])
    expect(later.events[0]).toMatchObject({ bush: 'bot', guess: 'mid' })
  })

  it('lists the decided winners in order, stopping at the first open event', () => {
    expect(decidedWinners(afterGank())).toEqual(['blue'])
  })
})

describe('hostMessages: draft', () => {
  it('starts the match once both teams are in', () => {
    const round = play([
      startDraft,
      { type: 'team', round: ROUND, player: HOST, team: teamA },
      { type: 'team', round: ROUND, player: GUEST, team: teamB },
    ])
    const [message] = hostMessages(round, context())
    expect(message).toMatchObject({ type: 'startMatch', teams: [teamA, teamB] })
  })

  it('waits for a connected player while the draft timer runs', () => {
    const round = play([startDraft, { type: 'team', round: ROUND, player: HOST, team: teamA }])
    expect(hostMessages(round, context({ now: 30_000 }))).toEqual([])
  })

  it('drafts a random team for a player who ran out of time or left', () => {
    const round = play([startDraft, { type: 'team', round: ROUND, player: HOST, team: teamA }])
    const timeUp = (TIMINGS.draft + TIMINGS.draftGrace) * 1000
    expect(hostMessages(round, context({ now: timeUp }))[0]).toMatchObject({ teams: [teamA, randomTeam()] })
    expect(hostMessages(round, context({ online: [HOST] }))[0]).toMatchObject({ teams: [teamA, randomTeam()] })
  })
})

describe('hostMessages: duels', () => {
  it('settles a duel once both players scored, higher score wins', () => {
    const round = [arrived(1, HOST), score(1, HOST, 40), score(1, GUEST, 90)].reduce<RoundState | null>(
      (state, message) => roundReducer(state, message, 0),
      afterGank(),
    )
    if (!round) throw new Error('No round')
    const [message] = hostMessages(round, context())
    expect(message).toMatchObject({ type: 'eventResult', event: 1, result: { winner: 'red', scores: { blue: 40, red: 90 } } })
  })

  it('waits for the other score, then gives them 0 when time is up or they left', () => {
    const round = roundReducer(roundReducer(afterGank(), arrived(1, HOST), 0), score(1, HOST, 55), 0)
    if (!round) throw new Error('No round')
    expect(hostMessages(round, context({ now: 5000 }))).toEqual([])
    const timeUp = (TIMINGS.duel + TIMINGS.eventGrace) * 1000
    expect(hostMessages(round, context({ now: timeUp }))[0]).toMatchObject({ result: { winner: 'blue', scores: { blue: 55, red: 0 } } })
    expect(hostMessages(round, context({ online: [HOST] }))[0]).toMatchObject({ result: { winner: 'blue' } })
  })

  it('does nothing until a player reaches the event', () => {
    expect(hostMessages(afterGank(), context())).toEqual([])
  })
})

describe('hostMessages: gank', () => {
  const ganker = liveScript(12)[0]?.ganker === 'blue' ? HOST : GUEST
  const defender = ganker === HOST ? GUEST : HOST
  const opened = play([startDraft, startMatch, arrived(0, HOST)])

  it('hides the jungler in a random bush when the ganker runs out of time or left', () => {
    expect(hostMessages(opened, context({ now: 1000 }))).toEqual([])
    const timeUp = (TIMINGS.intro + TIMINGS.gankHide + TIMINGS.eventGrace) * 1000
    expect(hostMessages(opened, context({ now: timeUp }))[0]).toMatchObject({ type: 'hide' })
    expect(hostMessages(opened, context({ online: [defender] }))[0]).toMatchObject({ type: 'hide' })
  })

  it('gives the fight to a defender who guesses right', () => {
    const round = play([
      startDraft,
      startMatch,
      arrived(0, HOST),
      { type: 'hide', round: ROUND, event: 0, bush: 'mid' },
      { type: 'guess', round: ROUND, event: 0, bush: 'mid' },
    ])
    const defenderSide = sideOf(round, defender)
    expect(hostMessages(round, context())[0]).toMatchObject({ result: { winner: defenderSide, bush: 'mid', guess: 'mid' } })
  })

  it('lets the gank land when the defender never guesses', () => {
    const round = play([startDraft, startMatch, arrived(0, HOST), { type: 'hide', round: ROUND, event: 0, bush: 'top' }])
    expect(hostMessages(round, context({ now: 1000 }))).toEqual([])
    const timeUp = (TIMINGS.intro + TIMINGS.gankGuess + TIMINGS.eventGrace) * 1000
    expect(hostMessages(round, context({ now: timeUp }))[0]).toMatchObject({
      result: { winner: sideOf(round, ganker), guess: null },
    })
  })
})

describe('hostMessages: surrender', () => {
  it('stops settling anything once a player surrendered', () => {
    const round = play([startDraft, startMatch, arrived(0, HOST), { type: 'surrender', round: ROUND, player: GUEST }])
    expect(round.surrendered).toBe(GUEST)
    expect(hostMessages(round, context({ online: [HOST] }))).toEqual([])
  })
})

describe('parseRoomMessage', () => {
  it('accepts every valid message', () => {
    const messages: RoomMessage[] = [startDraft, startMatch, arrived(2, HOST), score(2, HOST, 100)]
    for (const message of messages) expect(parseRoomMessage(JSON.parse(JSON.stringify(message)))).toEqual(message)
    expect(parseRoomMessage({ type: 'emote', player: HOST, emote: 'GG' })).not.toBeNull()
  })

  it('drops malformed messages', () => {
    expect(parseRoomMessage(null)).toBeNull()
    expect(parseRoomMessage({ type: 'hack' })).toBeNull()
    expect(parseRoomMessage({ ...score(1, HOST, 50), score: 9000 })).toBeNull()
    expect(parseRoomMessage({ type: 'emote', player: HOST, emote: '<script>' })).toBeNull()
    expect(parseRoomMessage({ type: 'hide', round: ROUND, event: 0, bush: 'baron pit' })).toBeNull()
  })
})

describe('lobbyPlayers', () => {
  const player = (id: string, joinedAt: number): PresenceInfo => ({ id, name: id, joinedAt, ready: false, playing: false })

  it('puts the earliest player first as the host and leaves out a third', () => {
    expect(lobbyPlayers([player('c', 3), player('a', 1), player('b', 2)]).map(({ id }) => id)).toEqual(['a', 'b'])
  })

  it('parses presence from the network', () => {
    expect(parsePresence({ ...player('a', 1), presence_ref: 'x' })).toEqual(player('a', 1))
    expect(parsePresence({ id: 'a' })).toBeNull()
  })
})
