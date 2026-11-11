import { describe, expect, it } from 'vitest'
import type { Champion, Role } from '../../data/types'
import { makeChampion } from '../testUtils'
import { coachNotes, compLines, liabilityLine, mvpLine } from './coachNotes'
import { COACH_LINES } from './feedback'
import type { ChampionRating } from './rateTeam'

function rating(champion: Partial<Champion>, role: Role, score: number, onRole = false): ChampionRating {
  return {
    role,
    champion: makeChampion(champion),
    roleFit: { kind: onRole ? 'mainRole' : 'offRole', score: onRole ? 100 : 0, usualRole: null },
    items: [],
    itemFit: 50,
    score,
    verdict: '',
    feedback: [],
  }
}

describe('mvpLine and liabilityLine', () => {
  const team = [
    rating({ id: 'Ahri' }, 'MIDDLE', 90, true),
    rating({ id: 'Garen' }, 'TOP', 60, true),
    rating({ id: 'Teemo' }, 'BOTTOM', 10),
  ]

  it('names the best champion as MVP', () => {
    expect(mvpLine(team)).toBeOneOf(COACH_LINES.mvp('Ahri', 'Mid'))
  })

  it('names the worst champion as liability', () => {
    expect(liabilityLine(team)).toBeOneOf(COACH_LINES.liability('Teemo', 'ADC'))
  })

  it('names no liability when everyone scored the same', () => {
    expect(liabilityLine([rating({ id: 'A' }, 'TOP', 50), rating({ id: 'B' }, 'MIDDLE', 50)])).toBeNull()
  })

  it('has nothing to say about an empty team', () => {
    expect(coachNotes([])).toEqual([])
  })
})

describe('compLines', () => {
  it('jokes about three or more junglers', () => {
    const junglers = ['Vi', 'LeeSin', 'Rammus'].map((id) => rating({ id, positions: ['JUNGLE'] }, 'TOP', 30))
    expect(compLines(junglers)).toContainEqual(expect.toBeOneOf(COACH_LINES.manyJunglers(3)))
  })

  it('jokes about three or more supports', () => {
    const supports = ['Janna', 'Lulu', 'Soraka'].map((id) => rating({ id, positions: ['SUPPORT'] }, 'TOP', 30))
    expect(compLines(supports)).toContainEqual(expect.toBeOneOf(COACH_LINES.manySupports(3)))
  })

  it('jokes about two or more marksmen', () => {
    const marksmen = ['Jinx', 'Ashe'].map((id) => rating({ id, classes: ['Marksman'] }, 'TOP', 30))
    expect(compLines(marksmen)).toContainEqual(expect.toBeOneOf(COACH_LINES.manyMarksmen(2)))
  })

  it('notices when nobody is on role', () => {
    expect(compLines([rating({ id: 'A' }, 'TOP', 10)])).toContainEqual(expect.toBeOneOf(COACH_LINES.nobodyOnRole()))
  })

  it('notices when everybody is on role', () => {
    expect(compLines([rating({ id: 'A' }, 'TOP', 90, true)])).toContainEqual(
      expect.toBeOneOf(COACH_LINES.everyoneOnRole()),
    )
  })
})
