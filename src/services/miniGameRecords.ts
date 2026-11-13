import { MINI_GAME_IDS, type MiniGameId } from '../game/minigames/catalog'
import { addOutcome, emptyRecord, parseRecord, type GameOutcome, type MiniGameRecord, type RecordUpdate } from '../game/minigames/records'
import { readJson, writeJson } from './storage'

const KEY = 'minigame-bests'

export type MiniGameRecords = Partial<Record<MiniGameId, MiniGameRecord>>

/** Your records in every mini-game, from this browser. */
export function readRecords(): MiniGameRecords {
  const stored = readJson<Record<string, unknown>>(KEY) ?? {}
  const records: MiniGameRecords = {}
  for (const id of MINI_GAME_IDS) {
    const record = parseRecord(stored[id])
    if (record) records[id] = record
  }
  return records
}

/** Saves a finished game against the bot and tells what improved. */
export function saveOutcome(id: MiniGameId, outcome: GameOutcome): RecordUpdate {
  const records = readRecords()
  const update = addOutcome(records[id] ?? emptyRecord(), outcome)
  writeJson(KEY, { ...records, [id]: update.record })
  return update
}
