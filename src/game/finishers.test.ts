import { describe, expect, it } from 'vitest'
import { gameData } from '../data'
import { finisherFor, FINISHERS, finisherUrl } from './finishers'

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

  it('lives in public/finishers', () => {
    const caitlyn = FINISHERS.Caitlyn
    expect(caitlyn && finisherUrl(caitlyn, '/rift/')).toBe('/rift/finishers/arcane-caitlyn.mp4')
  })
})
