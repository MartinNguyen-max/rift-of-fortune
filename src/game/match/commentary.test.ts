import { describe, expect, it } from 'vitest'
import { makeChampion, makeItem } from '../testUtils'
import { rateChampion } from '../scoring/rateTeam'
import {
  CALLBACK_LINES,
  commentate,
  draftIssues,
  formatGameTime,
  lineContext,
  lineKey,
  lowercaseYourMidSentence,
  MATCH_LINES,
  type LineContext,
} from './commentary'
import { simulateMatch } from './simulateMatch'
import { makeEvent, sampleTeams } from './testUtils'

const teams = sampleTeams()
const matches = Array.from({ length: 60 }, (_, seed) => simulateMatch(teams, seed))

const context: LineContext = {
  team: 'Your team',
  enemy: 'Team Bot',
  actor: 'Jinx',
  target: 'Garen',
  actorRole: 'ADC',
  targetRole: 'Top',
  lane: 'bot lane',
  dragon: 'Infernal',
  kills: '4 for 1',
  time: '21:05',
}

describe('MATCH_LINES', () => {
  it('has at least one line for every event and caster, with every blank filled in', () => {
    for (const byCaster of Object.values(MATCH_LINES)) {
      for (const lines of Object.values(byCaster)) {
        const texts = lines(context)
        expect(texts.length).toBeGreaterThan(0)
        for (const text of texts) expect(text).not.toMatch(/undefined|\$\{|\s{2}/)
      }
    }
  })

  it('fills in every callback line', () => {
    for (const lines of Object.values(CALLBACK_LINES)) {
      for (const text of lines('Garen', 'Support')) expect(text).toContain('Garen')
    }
  })
})

describe('lineKey', () => {
  it('picks the most specific line for an event', () => {
    expect(lineKey(makeEvent({ kind: 'soloKill', tags: ['firstBlood', 'upset'] }))).toBe('firstBlood')
    expect(lineKey(makeEvent({ kind: 'soloKill', tags: ['upset'] }))).toBe('soloKillUpset')
    expect(lineKey(makeEvent({ kind: 'gank', tags: ['escape'] }))).toBe('gankEscape')
    expect(lineKey(makeEvent({ kind: 'gank', tags: ['counterGank'] }))).toBe('counterGank')
    expect(lineKey(makeEvent({ kind: 'teamfight', tags: ['ace', 'pentakill'] }))).toBe('pentakill')
    expect(lineKey(makeEvent({ kind: 'teamfight', tags: ['ace'] }))).toBe('ace')
    expect(lineKey(makeEvent({ kind: 'dragon', tags: ['steal', 'soul'] }))).toBe('dragonSteal')
    expect(lineKey(makeEvent({ kind: 'dragon', tags: ['soul'] }))).toBe('soul')
    expect(lineKey(makeEvent({ kind: 'baron', tags: ['steal'] }))).toBe('baronSteal')
    expect(lineKey(makeEvent({ kind: 'tower', tags: ['firstTower'] }))).toBe('firstTower')
    expect(lineKey(makeEvent({ kind: 'nexus' }))).toBe('nexus')
  })
})

describe('lineContext', () => {
  it('names the teams, champions and teamfight score from the event', () => {
    const jungler = teams.red.rating.champions.find(({ role }) => role === 'JUNGLE')
    const result = lineContext(
      makeEvent({
        kind: 'teamfight',
        side: 'red',
        actor: { side: 'red', role: 'JUNGLE' },
        fightKills: { red: 4, blue: 1 },
        spot: 'top',
        time: 1265,
      }),
      teams,
    )
    expect(result).toMatchObject({ team: 'Team Bot', enemy: 'Your team', kills: '4 for 1', lane: 'top lane', time: '21:05' })
    expect(result.actor).toBe(jungler?.champion.name)
  })
})

describe('commentate', () => {
  it('gives one line per event and is reproducible', () => {
    for (const match of matches.slice(0, 10)) {
      const lines = commentate(match, teams)
      expect(lines).toHaveLength(match.events.length)
      expect(commentate(match, teams)).toEqual(lines)
    }
  })

  it('never leaves a blank in a line', () => {
    for (const match of matches) {
      for (const { text } of commentate(match, teams)) expect(text).not.toMatch(/undefined|^\s|\s{2}|\s$/)
    }
  })

  it('roasts each draft mistake at most once per match', () => {
    for (const match of matches) {
      const roasts = commentate(match, teams)
        .filter(({ callback }) => callback)
        .map(({ text }) => text)
      expect(new Set(roasts).size).toBe(roasts.length)
    }
  })

  it('remembers bad picks from the draft', () => {
    const issues = teams.red.rating.champions.flatMap(draftIssues)
    expect(issues.length).toBeGreaterThan(0)
    const roasts = matches.flatMap((match) => commentate(match, teams).filter(({ callback }) => callback))
    expect(roasts.length).toBeGreaterThan(0)
    for (const roast of roasts) expect(roast.caster).toBe('analyst')
  })
})

describe('draftIssues', () => {
  it('flags a champion far off-role holding a useless item', () => {
    const rating = rateChampion({
      role: 'JUNGLE',
      champion: makeChampion({ id: 'Janna', classes: ['Support'], positions: ['SUPPORT'], damageType: 'AP' }),
      items: [makeItem({ id: 'Edge', stats: { attackDamage: 60, critChance: 25 } })],
    })
    expect(draftIssues(rating)).toEqual([
      { kind: 'offRole', role: 'Jungle' },
      { kind: 'badItem', item: 'Edge' },
    ])
  })

  it('has nothing to say about a champion on role with fitting items', () => {
    const rating = rateChampion({
      role: 'BOTTOM',
      champion: makeChampion({ id: 'Jinx', classes: ['Marksman'], positions: ['BOTTOM'], attackType: 'RANGED' }),
      items: [makeItem({ id: 'Edge', stats: { attackDamage: 60, critChance: 25 } })],
    })
    expect(draftIssues(rating)).toEqual([])
  })
})

describe('lowercaseYourMidSentence', () => {
  it('lowercases "Your team" only in the middle of a sentence', () => {
    expect(lowercaseYourMidSentence('2 for 1 for Your team. Your team wins!')).toBe('2 for 1 for your team. Your team wins!')
    expect(lowercaseYourMidSentence('GG! Your team destroys the Nexus!')).toBe('GG! Your team destroys the Nexus!')
  })
})

describe('formatGameTime', () => {
  it('formats seconds as minutes and seconds', () => {
    expect(formatGameTime(0)).toBe('0:00')
    expect(formatGameTime(65)).toBe('1:05')
    expect(formatGameTime(1834)).toBe('30:34')
  })
})
