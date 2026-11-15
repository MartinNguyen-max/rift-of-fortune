import { describe, expect, it } from 'vitest'
import { gameData } from '../data'
import { finisherAfter, finisherFor, FINISHERS, finisherUrl, gameHasFinishers } from './finishers'

describe('finishers', () => {
  it('belong to real champions, each with its own file', () => {
    const ids = new Set(gameData.champions.map(({ id }) => id))
    for (const champion of Object.keys(FINISHERS)) expect(ids, champion).toContain(champion)
    const files = Object.values(FINISHERS).map(({ file }) => file)
    expect(new Set(files).size).toBe(files.length)
    for (const file of files) expect(file).toMatch(/^[a-z0-9-]+\.mp4$/)
  })

  it('finds a champion’s finisher, or none', () => {
    expect(finisherFor('Caitlyn')?.title).toBe('Chibi Arcane Caitlyn')
    expect(finisherFor('Udyr')).toBeNull()
  })

  it('skips games where you don’t play the champions shown', () => {
    expect(finisherAfter('shrooms', 'Teemo')).toBeNull()
    expect(gameHasFinishers('shrooms')).toBe(false)
    expect(finisherAfter('duel', 'Caitlyn')?.title).toBe('Chibi Arcane Caitlyn')
  })

  it('lives in public/finishers', () => {
    const caitlyn = FINISHERS.Caitlyn
    expect(caitlyn && finisherUrl(caitlyn, '/rift/')).toBe('/rift/finishers/arcane-caitlyn.mp4')
  })
})
