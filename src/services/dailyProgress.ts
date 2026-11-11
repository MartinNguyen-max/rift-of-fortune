import type { GameState } from '../game/gameState'
import { readJson, writeJson } from './storage'

/** Today's Daily game, saved after every move so a refresh can't be used for a second try. */
interface SavedDaily {
  date: string
  state: GameState
}

const KEY = 'daily'

export function loadDaily(date: string): GameState | undefined {
  const saved = readJson<SavedDaily>(KEY)
  return saved?.date === date ? saved.state : undefined
}

export function saveDaily(date: string, state: GameState): void {
  writeJson(KEY, { date, state } satisfies SavedDaily)
}
