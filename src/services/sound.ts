import type { RankTier, SoundName } from '../data/types'
import { readJson, writeJson } from './storage'

/** Sound effects are on by default (quietly); music waits until the player turns it on. */
export interface SoundSettings {
  effects: boolean
  music: boolean
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = { effects: true, music: false }
export const EFFECTS_VOLUME = 0.15
/** Music is a quiet background layer, far below the effects. */
export const MUSIC_VOLUME = 0.02
/** Champion voice lines, a little louder than the effects so they can be heard. All sound stays very quiet. */
export const VOICE_VOLUME = 0.2

const STORAGE_KEY = 'sound'

/** Reads saved settings, falling back to the defaults for anything missing or broken. */
export function parseSoundSettings(raw: unknown): SoundSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SOUND_SETTINGS
  const { effects, music } = raw as Partial<Record<keyof SoundSettings, unknown>>
  return {
    effects: typeof effects === 'boolean' ? effects : DEFAULT_SOUND_SETTINGS.effects,
    music: typeof music === 'boolean' ? music : DEFAULT_SOUND_SETTINGS.music,
  }
}

const soundUrl = (name: SoundName) => `${import.meta.env.BASE_URL}sounds/${name}.ogg`

let settings: SoundSettings = parseSoundSettings(readJson(STORAGE_KEY))
const listeners = new Set<() => void>()
let musicPlayer: HTMLAudioElement | null = null

export const getSoundSettings = (): SoundSettings => settings

export function subscribeToSound(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setSoundSettings(change: Partial<SoundSettings>): void {
  settings = { ...settings, ...change }
  writeJson(STORAGE_KEY, settings)
  for (const listener of listeners) listener()
  syncMusic()
}

/** Plays a short League client sound, unless effects are muted. Never throws. */
export function playSound(name: Exclude<SoundName, 'music'>): void {
  if (!settings.effects || typeof Audio === 'undefined') return
  const audio = new Audio(soundUrl(name))
  audio.volume = EFFECTS_VOLUME
  audio.play().catch(() => {
    // The browser blocked it (no click yet) or the file failed: the game works fine without sound.
  })
}

/** Starts or stops the looping draft music to match the settings. */
function syncMusic(): void {
  if (typeof Audio === 'undefined') return
  if (!settings.music) {
    musicPlayer?.pause()
    return
  }
  musicPlayer ??= Object.assign(new Audio(soundUrl('music')), { loop: true, volume: MUSIC_VOLUME })
  musicPlayer.play().catch(() => {
    // Browsers only allow music after a click or tap; try again on the next one.
    window.addEventListener('pointerdown', syncMusic, { once: true })
  })
}

/** Music saved as "on" from an earlier visit starts with the first click or tap. */
export function startSavedMusic(): void {
  if (settings.music) syncMusic()
}

/** League's own end-of-game burst for each ranked tier. */
export const RANK_SOUNDS: Record<RankTier, Exclude<SoundName, 'music'>> = {
  Iron: 'rank-iron',
  Bronze: 'rank-bronze',
  Silver: 'rank-silver',
  Gold: 'rank-gold',
  Platinum: 'rank-platinum',
  Emerald: 'rank-emerald',
  Diamond: 'rank-diamond',
  Master: 'rank-master',
  Grandmaster: 'rank-grandmaster',
  Challenger: 'rank-challenger',
}

/**
 * Loads a champion's champion select voice line ("Jinx! Let's do this!") and returns a function
 * that plays it, so it can start right as the roll lands. Silent when effects are muted.
 */
export function prepareChampionVoice(championId: string): () => void {
  if (typeof Audio === 'undefined') return () => {}
  const audio = new Audio(`${import.meta.env.BASE_URL}sounds/champions/${championId}.ogg`)
  audio.preload = 'auto'
  audio.volume = VOICE_VOLUME
  return () => {
    if (!settings.effects) return
    audio.play().catch(() => {
      // Blocked or missing: the roll works fine without the voice.
    })
  }
}

/** Music stops as soon as the tab is hidden (phone locked, app switched) and comes back with it. */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) musicPlayer?.pause()
    else syncMusic()
  })
}
