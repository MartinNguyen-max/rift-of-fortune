import { writeFile } from 'node:fs/promises'
import type { GameData } from '../src/data/types.ts'
import {
  dedupeByName,
  isFullItem,
  toChampion,
  toItem,
  type DDragonChampion,
  type DDragonItem,
  type MerakiChampion,
} from './transform.ts'

const DDRAGON = 'https://ddragon.leagueoflegends.com'
const MERAKI_CHAMPIONS = 'https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json'
const OUTPUT = new URL('../src/data/game-data.json', import.meta.url)

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`)
  return (await response.json()) as T
}

async function main(): Promise<void> {
  const [patch] = await fetchJson<string[]>(`${DDRAGON}/api/versions.json`)
  if (!patch) throw new Error('No Data Dragon versions found')
  console.log(`Latest patch: ${patch}`)

  const [championFile, itemFile, meraki] = await Promise.all([
    fetchJson<{ data: Record<string, DDragonChampion> }>(`${DDRAGON}/cdn/${patch}/data/en_US/champion.json`),
    fetchJson<{ data: Record<string, DDragonItem> }>(`${DDRAGON}/cdn/${patch}/data/en_US/item.json`),
    fetchJson<Record<string, MerakiChampion>>(MERAKI_CHAMPIONS),
  ])

  const champions = Object.values(championFile.data)
    .map((champion) => toChampion(champion, meraki[champion.id]))
    .sort((a, b) => a.name.localeCompare(b.name))

  const missingInMeraki = champions.filter((champion) => !meraki[champion.id]).map((c) => c.name)
  if (missingInMeraki.length > 0) {
    console.warn(`Not in Meraki yet, positions guessed from class: ${missingInMeraki.join(', ')}`)
  }

  const items = dedupeByName(
    Object.entries(itemFile.data)
      .filter(([id, item]) => isFullItem(id, item))
      .map(([id, item]) => toItem(id, item)),
  )

  const data: GameData = { patch, champions, items }
  await writeFile(OUTPUT, `${JSON.stringify(data, null, 2)}\n`)
  console.log(`Saved ${champions.length} champions and ${items.length} items to src/data/game-data.json`)
}

await main()
