import { mkdir, writeFile } from 'node:fs/promises'
import { championVoicePath, END_OF_GAME_ICONS, MAP_ICONS, RANK_TIERS, SOUND_FILES, type Champion, type GameData } from '../src/data/types.ts'
import {
  dedupeByName,
  isFullItem,
  parseWikiPositions,
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
/** The League of Legends Wiki's champion data: which roles each champion is really played in (CC BY-SA). */
const WIKI_CHAMPIONS = 'https://wiki.leagueoflegends.com/en-us/Module:ChampionData/data?action=raw'
const OUTPUT = new URL('../src/data/game-data.json', import.meta.url)
/** Ranked emblems aren't on Data Dragon, so they come from CommunityDragon and are saved into the repo. */
const RANK_EMBLEMS = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default'
const RANK_OUTPUT = new URL('../public/ranks/', import.meta.url)
/** Minimap icons (towers, Baron, dragons...) for Match vs Bots, also from CommunityDragon. */
const MAP_ICON_SOURCE = 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons'
const MAP_ICON_OUTPUT = new URL('../public/icons/', import.meta.url)

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`)
  return (await response.json()) as T
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': 'rift-of-fortune-data-script' } })
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`)
  return response.text()
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

async function downloadMapIcons(): Promise<void> {
  await mkdir(MAP_ICON_OUTPUT, { recursive: true })
  await Promise.all(
    Object.entries(MAP_ICONS).map(async ([name, file]) => {
      const response = await fetch(`${MAP_ICON_SOURCE}/${file}.png`)
      if (!response.ok) throw new Error(`GET ${file}.png failed: ${response.status}`)
      await writeFile(new URL(`${name}.png`, MAP_ICON_OUTPUT), Buffer.from(await response.arrayBuffer()))
    }),
  )
  console.log(`Saved ${Object.keys(MAP_ICONS).length} minimap icons to public/icons/`)
}

/** Saves CommunityDragon files (League client sounds and crests) into `folder` under public/. */
async function downloadClientFiles(files: Record<string, string>, folder: string, extension: string): Promise<void> {
  const output = new URL(`../public/${folder}/`, import.meta.url)
  await mkdir(output, { recursive: true })
  for (const [name, path] of Object.entries(files)) {
    const response = await fetch(`https://raw.communitydragon.org/latest/${path}`)
    if (!response.ok) throw new Error(`GET ${path} failed: ${response.status}`)
    await writeFile(new URL(`${name}.${extension}`, output), Buffer.from(await response.arrayBuffer()))
  }
  console.log(`Saved ${Object.keys(files).length} files to public/${folder}/`)
}

/** Saves every champion's voice line to public/sounds/champions/, a few at a time. Missing ones are skipped. */
async function downloadChampionVoices(champions: Champion[]): Promise<void> {
  const output = new URL('../public/sounds/champions/', import.meta.url)
  await mkdir(output, { recursive: true })
  const queue = [...champions]
  const missing: string[] = []
  const worker = async () => {
    for (let champion = queue.shift(); champion; champion = queue.shift()) {
      const response = await fetch(`https://raw.communitydragon.org/latest/${championVoicePath(champion.key)}`)
      if (!response.ok) {
        missing.push(champion.name)
        continue
      }
      await writeFile(new URL(`${champion.id}.ogg`, output), Buffer.from(await response.arrayBuffer()))
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  console.log(`Saved ${champions.length - missing.length} champion voice lines to public/sounds/champions/`)
  if (missing.length > 0) console.warn(`No voice line yet for: ${missing.join(', ')}`)
}

async function main(): Promise<void> {
  const [patch] = await fetchJson<string[]>(`${DDRAGON}/api/versions.json`)
  if (!patch) throw new Error('No Data Dragon versions found')
  console.log(`Latest patch: ${patch}`)

  const [championFile, itemFile, meraki, rates, wikiLua] = await Promise.all([
    fetchJson<{ data: Record<string, DDragonChampion> }>(`${DDRAGON}/cdn/${patch}/data/en_US/champion.json`),
    fetchJson<{ data: Record<string, DDragonItem> }>(`${DDRAGON}/cdn/${patch}/data/en_US/item.json`),
    fetchJson<Record<string, MerakiChampion>>(MERAKI_CHAMPIONS),
    fetchJson<{ data: Record<string, MerakiRoleRates> }>(MERAKI_RATES),
    fetchText(WIKI_CHAMPIONS),
  ])

  const wikiPositions = parseWikiPositions(wikiLua)
  const champions = Object.values(championFile.data)
    .map((champion) => toChampion(champion, meraki[champion.id], rates.data[champion.key], wikiPositions[champion.id]))
    .sort((a, b) => a.name.localeCompare(b.name))

  const missingInMeraki = champions.filter((champion) => !meraki[champion.id]).map((c) => c.name)
  if (missingInMeraki.length > 0) {
    console.warn(`Not in Meraki yet, positions from the wiki or guessed from class: ${missingInMeraki.join(', ')}`)
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
  await downloadMapIcons()
  await downloadClientFiles(END_OF_GAME_ICONS, 'icons', 'png')
  await downloadClientFiles(SOUND_FILES, 'sounds', 'ogg')
  await downloadChampionVoices(champions)
}

await main()
