import { readJson, writeJson } from './storage'

const STORAGE_KEY = 'solo-finishers'

/** Solo mini-games: the winner's finisher clip is off until the player turns it on. */
export const readSoloFinishers = (): boolean => readJson<unknown>(STORAGE_KEY) === true

export const saveSoloFinishers = (on: boolean): void => writeJson(STORAGE_KEY, on)
