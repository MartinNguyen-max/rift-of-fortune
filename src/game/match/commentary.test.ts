import { describe, expect, it } from 'vitest'
import { makeChampion, makeItem } from '../testUtils'
import { rateChampion } from '../scoring/rateTeam'
import {
  CALLBACK_LINES,
  commentate,
  describeEvent,
  momentTitle,
  draftIssues,
  formatGameTime,
  lineContext,
  lineKey,
  lowercaseYourMidSentence,
  MATCH_LINES,
  ROASTS_PER_MATCH,
  type LineContext,
} from './commentary'
import { simulateMatch } from './simulateMatch'
import { makeEvent, sampleTeams } from './testUtils'

const teams = sampleTeams()
const matches = Array.from({ length: 60 }, (_, seed) => simulateMatch(teams, seed))

/** With typical names, about two seconds of reading. */
const MAX_LINE_LENGTH = 64

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

  it('keeps every line short enough to read at full speed', () => {
    const texts = [
      ...Object.values(MATCH_LINES).flatMap((byCaster) => Object.values(byCaster).flatMap((lines) => lines(context))),
      ...Object.values(CALLBACK_LINES).flatMap((lines) => lines('Garen', 'Support')),
    ]
    for (const text of texts) expect(text.length, text).toBeLessThanOrEqual(MAX_LINE_LENGTH)
  })

  it('fills in every callback line', () => {
    for (const lines of Object.values(CALLBACK_LINES)) {
      for (const text of lines('Garen', 'Support')) expect(text).toContain('Garen')
    }
  })
})

describe('lineKey', () => {
  it('picks the most specific line for a big moment', () => {
    expect(lineKey(makeEvent({ kind: 'soloKill', big: true, tags: ['firstBlood', 'upset'] }))).toBe('firstBlood')
    expect(lineKey(makeEvent({ kind: 'gank', big: true, tags: ['firstBlood', 'counterGank'] }))).toBe('firstBlood')
    expect(lineKey(makeEvent({ kind: 'teamfight', big: true, tags: ['ace', 'pentakill'] }))).toBe('pentakill')
    expect(lineKey(makeEvent({ kind: 'teamfight', big: true, tags: ['ace'] }))).toBe('ace')
    expect(lineKey(makeEvent({ kind: 'teamfight', big: true, tags: ['upset'] }))).toBe('teamfightUpset')
    expect(lineKey(makeEvent({ kind: 'dragon', big: true, tags: ['steal', 'soul'] }))).toBe('dragonSteal')
    expect(lineKey(makeEvent({ kind: 'dragon', big: true, tags: ['soul'] }))).toBe('soul')
    expect(lineKey(makeEvent({ kind: 'baron', big: true, tags: ['steal'] }))).toBe('baronSteal')
    expect(lineKey(makeEvent({ kind: 'nexus', big: true }))).toBe('nexus')
  })

  it('gives small events no caster line', () => {
    expect(lineKey(makeEvent({ kind: 'tower', tags: ['firstTower'] }))).toBeNull()
    expect(lineKey(makeEvent({ kind: 'soloKill' }))).toBeNull()
    expect(lineKey(makeEvent({ kind: 'teamfight', tags: ['upset'] }))).toBeNull()
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
  const allLines = matches.map((match) => commentate(match, teams))
  const spoken = allLines.flat().filter((line) => line !== null)

  it('gives one entry per event and is reproducible', () => {
    for (const [index, match] of matches.slice(0, 10).entries()) {
      expect(allLines[index]).toHaveLength(match.events.length)
      expect(commentate(match, teams)).toEqual(allLines[index])
    }
  })

  it('gives every big moment its own line, never a roast', () => {
    for (const [index, match] of matches.entries()) {
      for (const [eventIndex, event] of match.events.entries()) {
        if (event.big) expect(allLines[index]?.[eventIndex]?.callback).toBe(false)
      }
    }
  })

  it('stays quiet on small events, apart from a few roasts', () => {
    for (const [index, match] of matches.entries()) {
      const lines = allLines[index] ?? []
      const small = match.events.flatMap((event, eventIndex) => (event.big ? [] : [lines[eventIndex]]))
      expect(small.every((line) => !line || line.callback)).toBe(true)
      expect(lines.filter((line) => line?.callback).length).toBeLessThanOrEqual(ROASTS_PER_MATCH)
    }
  })

  it('never leaves a blank in a line', () => {
    for (const { text } of spoken) expect(text).not.toMatch(/undefined|^\s|\s{2}|\s$/)
  })

  it('roasts each draft mistake at most once per match', () => {
    for (const lines of allLines) {
      const roasts = lines.filter((line) => line?.callback).map((line) => line?.text)
      expect(new Set(roasts).size).toBe(roasts.length)
    }
  })

  it('remembers bad picks from the draft', () => {
    const issues = teams.red.rating.champions.flatMap(draftIssues)
    expect(issues.length).toBeGreaterThan(0)
    const roasts = spoken.filter(({ callback }) => callback)
    expect(roasts.length).toBeGreaterThan(0)
    for (const roast of roasts) expect(roast.caster).toBe('analyst')
  })
})

describe('describeEvent', () => {
  it('describes every event in plain words', () => {
    for (const match of matches.slice(0, 20)) {
      for (const event of match.events) {
        const text = describeEvent(event, teams)
        expect(text.length).toBeGreaterThan(5)
        expect(text).not.toMatch(/undefined|^\s|\s{2}|\s$/)
      }
    }
  })

  it('names the killer and the victim', () => {
    const event = makeEvent({ kind: 'soloKill', actor: { side: 'blue', role: 'MIDDLE' }, target: { side: 'red', role: 'TOP' } })
    const mid = teams.blue.rating.champions.find(({ role }) => role === 'MIDDLE')?.champion.name
    const top = teams.red.rating.champions.find(({ role }) => role === 'TOP')?.champion.name
    expect(describeEvent(event, teams)).toBe(`${mid} killed ${top}`)
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


describe('momentTitle', () => {
  it('names the big moment for the fight scene', () => {
    expect(momentTitle(makeEvent({ kind: 'teamfight', tags: ['ace', 'pentakill'] }))).toBe('Pentakill!')
    expect(momentTitle(makeEvent({ kind: 'teamfight', tags: ['ace'] }))).toBe('Ace!')
    expect(momentTitle(makeEvent({ kind: 'baron', tags: ['steal'] }))).toBe('Baron stolen!')
    expect(momentTitle(makeEvent({ kind: 'gank', tags: ['firstBlood'] }))).toBe('First blood!')
  })

  it('shows the end from the player side', () => {
    expect(momentTitle(makeEvent({ kind: 'nexus', side: 'blue' }))).toBe('Victory!')
    expect(momentTitle(makeEvent({ kind: 'surrender', side: 'red' }))).toBe('Defeat')
  })

  it('has a title for every big moment in real matches', () => {
    for (const match of matches) {
      for (const event of match.events) if (event.big) expect(momentTitle(event)).not.toBe('')
    }
  })
})
