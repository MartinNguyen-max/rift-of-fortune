import { describe, expect, it } from 'vitest'
import { gameData } from '../../data'
import { gameReducer, initialGameState, type GameState } from '../gameState'
import { drawItems } from '../items'
import { seededRandom } from '../random'
import { ROLES } from '../roles'
import { MATCH_RULES } from '../rules'
import { completeTeam } from './completeTeam'
import { createRoomCode, isRoomCode, parseRoomCode, ROOM_CODE_LENGTH } from './roomCode'
import { decodeTeam, encodeTeam, isEncodedTeam, randomEncodedTeam } from './teamCode'
import { randomTeamName, TEAM_NAMES } from './teamNames'

const [ahri, garen, jinx] = gameData.champions as [
  (typeof gameData.champions)[number],
  (typeof gameData.champions)[number],
  (typeof gameData.champions)[number],
]

describe('room codes', () => {
  it('are five characters without look-alikes like 0/O or 1/I', () => {
    for (let seed = 0; seed < 50; seed++) {
      const code = createRoomCode(seededRandom(seed))
      expect(code).toHaveLength(ROOM_CODE_LENGTH)
      expect(isRoomCode(code)).toBe(true)
      expect(code).not.toMatch(/[01IO]/)
    }
  })

  it('accept lowercase, spaces, dashes and whole invite links', () => {
    expect(parseRoomCode('k7q2x')).toBe('K7Q2X')
    expect(parseRoomCode(' K7Q-2X ')).toBe('K7Q2X')
    expect(parseRoomCode('https://example.com/#/play/K7Q2X')).toBe('K7Q2X')
  })

  it('reject anything else', () => {
    expect(parseRoomCode('K7Q2')).toBeNull()
    expect(parseRoomCode('K7Q2O')).toBeNull()
    expect(parseRoomCode('')).toBeNull()
  })
})

describe('team names', () => {
  it('never gives both players the same name', () => {
    for (let seed = 0; seed < 50; seed++) {
      const random = seededRandom(seed)
      const first = randomTeamName(random)
      expect(TEAM_NAMES).toContain(first)
      expect(randomTeamName(random, first)).not.toBe(first)
    }
  })
})

describe('completeTeam', () => {
  const random = () => seededRandom(3)

  it('drafts a whole random team when the player did nothing', () => {
    const members = completeTeam(null, gameData, random())
    expect(members.map(({ role }) => role)).toEqual([...ROLES])
    expect(new Set(members.map(({ champion }) => champion.id)).size).toBe(5)
    for (const { items } of members) expect(items).toHaveLength(2)
  })

  it('keeps placed champions and places the rolled one', () => {
    let state: GameState = initialGameState(MATCH_RULES)
    state = gameReducer(state, { type: 'roll', champion: ahri })
    state = gameReducer(state, { type: 'reveal' })
    state = gameReducer(state, { type: 'place', role: 'MIDDLE' })
    state = gameReducer(state, { type: 'roll', champion: garen })
    const members = completeTeam(state, gameData, random())
    expect(members.find(({ role }) => role === 'MIDDLE')?.champion).toBe(ahri)
    expect(members.some(({ champion }) => champion === garen)).toBe(true)
  })

  it('keeps handed-out items and gives the rest to champions with room', () => {
    let state: GameState = initialGameState(MATCH_RULES)
    for (const [index, role] of ROLES.entries()) {
      state = gameReducer(state, { type: 'roll', champion: gameData.champions[index] ?? jinx })
      state = gameReducer(state, { type: 'reveal' })
      state = gameReducer(state, { type: 'place', role })
    }
    const items = drawItems(gameData.items, seededRandom(1))
    state = gameReducer(state, { type: 'startItems', items })
    state = gameReducer(state, { type: 'revealItems' })
    const first = items[0]
    if (!first) throw new Error('No items')
    state = gameReducer(state, { type: 'assignItem', itemId: first.id, role: 'SUPPORT' })

    const members = completeTeam(state, gameData, random())
    expect(members.find(({ role }) => role === 'SUPPORT')?.items).toContain(first)
    const ids = (list: readonly { id: string }[]) => list.map(({ id }) => id).sort()
    expect(ids(members.flatMap((member) => member.items))).toEqual(ids(items))
    for (const member of members) expect(member.items).toHaveLength(2)
  })
})

describe('team codes', () => {
  const members = completeTeam(null, gameData, seededRandom(8))

  it('survive a round trip through the network', () => {
    const encoded = JSON.parse(JSON.stringify(encodeTeam(members))) as unknown
    expect(isEncodedTeam(encoded)).toBe(true)
    if (isEncodedTeam(encoded)) expect(decodeTeam(encoded, gameData)).toEqual(members)
  })

  it('reject unknown champions, missing roles and wrong item counts', () => {
    const [first, ...rest] = encodeTeam(members)
    if (!first) throw new Error('Empty team')
    expect(decodeTeam(rest, gameData)).toBeNull()
    expect(decodeTeam([{ ...first, champion: 'NotAChampion' }, ...rest], gameData)).toBeNull()
    expect(decodeTeam([{ ...first, items: [] }, ...rest], gameData)).toBeNull()
    expect(isEncodedTeam([{ role: 'CARRY', champion: 'Ahri', items: [] }])).toBe(false)
  })

  it('can make a full random team for a player who left', () => {
    expect(decodeTeam(randomEncodedTeam(gameData, seededRandom(2)), gameData)).not.toBeNull()
  })
})
