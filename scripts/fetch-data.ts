import { mkdir, writeFile } from 'node:fs/promises'
import { RANK_TIERS, type GameData } from '../src/data/types.ts'
import {
  dedupeByName,
  isFullItem,
  toChampion,
  toItem,
  type DDragonChampion,
  type DDragonItem,
  type MerakiChampion,
  type MerakiRoleRates,
} from './transform.ts'

const DDRAGON = 'https://ddragon.leagueoflegends.com'
const MERAKI_CHAMPIONS = 'https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json'
const MERAKI_RATES = 'https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/championrates.json'
const OUTPUT = new URL('../src/data/game-data.json', import.meta.url)
/** Ranked emblems aren't on Data Dragon, so they come from CommunityDragon and are saved into the repo. */
const RANK_EMBLEMS = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default'
const RANK_OUTPUT = new URL('../public/ranks/', import.meta.url)

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`)
  return (await response.json()) as T
}

async function downloadRankEmblems(): Promise<void> {
  await mkdir(RANK_OUTPUT, { recursive: true })
  await Promise.all(
    RANK_TIERS.map(async (tier) => {
      const file = `${tier.toLowerCase()}.png`
      const response = await fetch(`${RANK_EMBLEMS}/${file}`)
      if (!response.ok) throw new Error(`GET ${file} failed: ${response.status}`)
      await writeFile(new URL(file, RANK_OUTPUT), Buffer.from(await response.arrayBuffer()))
    }),
  )
  console.log(`Saved ${RANK_TIERS.length} rank emblems to public/ranks/`)
}

async function main(): Promise<void> {
  const [patch] = await fetchJson<string[]>(`${DDRAGON}/api/versions.json`)
  if (!patch) throw new Error('No Data Dragon versions found')
  console.log(`Latest patch: ${patch}`)

  const [championFile, itemFile, meraki, rates] = await Promise.all([
    fetchJson<{ data: Record<string, DDragonChampion> }>(`${DDRAGON}/cdn/${patch}/data/en_US/champion.json`),
    fetchJson<{ data: Record<string, DDragonItem> }>(`${DDRAGON}/cdn/${patch}/data/en_US/item.json`),
    fetchJson<Record<string, MerakiChampion>>(MERAKI_CHAMPIONS),
    fetchJson<{ data: Record<string, MerakiRoleRates> }>(MERAKI_RATES),
  ])

  const champions = Object.values(championFile.data)
    .map((champion) => toChampion(champion, meraki[champion.id], rates.data[champion.key]))
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

  await downloadRankEmblems()
}

await main()
