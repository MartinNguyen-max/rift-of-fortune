import { describe, expect, it } from 'vitest'
import { gameData } from '../../data'
import { bestMissedSwap, MIN_SWAP_GAIN } from './missedSwap'
import { rateTeam } from './rateTeam'
import type { TeamMember } from './teamBalance'

const champion = (id: string) => {
  const found = gameData.champions.find((entry) => entry.id === id)
  if (!found) throw new Error(`No champion ${id}`)
  return found
}
const item = (name: string) => {
  const found = gameData.items.find((entry) => entry.name === name)
  if (!found) throw new Error(`No item ${name}`)
  return found
}

const team = (jinxItem: string, leonaItem: string): TeamMember[] => [
  { role: 'TOP', champion: champion('Garen'), items: [item("Sterak's Gage"), item('Black Cleaver')] },
  { role: 'JUNGLE', champion: champion('Sejuani'), items: [item('Sunfire Aegis'), item('Thornmail')] },
  { role: 'MIDDLE', champion: champion('Lux'), items: [item("Luden's Echo"), item('Shadowflame')] },
  { role: 'BOTTOM', champion: champion('Jinx'), items: [item(jinxItem), item('Phantom Dancer')] },
  { role: 'SUPPORT', champion: champion('Leona'), items: [item(leonaItem), item("Zeke's Convergence")] },
]

describe('bestMissedSwap', () => {
  it('finds the item that belonged on another champion', () => {
    const swap = bestMissedSwap(rateTeam(team("Randuin's Omen", 'Infinity Edge')))
    expect(swap).not.toBeNull()
    expect(new Set([swap?.first.item.name, swap?.second.item.name])).toEqual(new Set(['Infinity Edge', "Randuin's Omen"]))
    expect(swap?.gain).toBeGreaterThanOrEqual(MIN_SWAP_GAIN)
  })

  it('says nothing when every item is already in the right place', () => {
    expect(bestMissedSwap(rateTeam(team('Infinity Edge', "Randuin's Omen")))).toBeNull()
  })
})
