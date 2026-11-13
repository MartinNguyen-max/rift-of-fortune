import { describe, expect, it } from 'vitest'
import { addOutcome, emptyRecord, parseRecord } from './records'

describe('addOutcome', () => {
  it('counts games, wins and the win streak', () => {
    const first = addOutcome(emptyRecord(), { winner: 0, score: null, lowerIsBetter: false })
    const second = addOutcome(first.record, { winner: 0, score: null, lowerIsBetter: false })
    expect(second.record).toMatchObject({ played: 2, wins: 2, streak: 2, bestStreak: 2 })
    expect(first.newBestStreak).toBe(false)
    expect(second.newBestStreak).toBe(true)
  })

  it('ends the streak on a loss and keeps it on a draw', () => {
    const won = addOutcome(emptyRecord(), { winner: 0, score: null, lowerIsBetter: false }).record
    expect(addOutcome(won, { winner: null, score: null, lowerIsBetter: false }).record.streak).toBe(1)
    const lost = addOutcome(won, { winner: 1, score: null, lowerIsBetter: false }).record
    expect(lost).toMatchObject({ streak: 0, bestStreak: 1, wins: 1, played: 2 })
  })

  it('keeps the best score: highest, or lowest for times', () => {
    const gold = addOutcome(emptyRecord(), { winner: 1, score: 800, lowerIsBetter: false })
    expect(gold).toMatchObject({ newBest: true, record: { best: 800 } })
    expect(addOutcome(gold.record, { winner: 0, score: 700, lowerIsBetter: false })).toMatchObject({ newBest: false, record: { best: 800 } })
    const time = addOutcome(emptyRecord(), { winner: 0, score: 250, lowerIsBetter: true }).record
    expect(addOutcome(time, { winner: 0, score: 210, lowerIsBetter: true })).toMatchObject({ newBest: true, record: { best: 210 } })
  })
})

describe('parseRecord', () => {
  it('reads a stored record and drops damaged ones', () => {
    expect(parseRecord({ played: 3, wins: 1, streak: 0, bestStreak: 1, best: 240 })).toEqual({
      played: 3,
      wins: 1,
      streak: 0,
      bestStreak: 1,
      best: 240,
    })
    expect(parseRecord({ played: -1, wins: 0, streak: 0, bestStreak: 0, best: null })).toBeNull()
    expect(parseRecord('nope')).toBeNull()
  })
})
