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
export const MUSIC_VOLUME = 0.03
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

type EffectName = Exclude<SoundName, 'music'>

/** One loaded copy of each effect. Playing clones it, so the file is never fetched again and starts at once. */
const loadedEffects = new Map<EffectName, HTMLAudioElement>()

function loadedEffect(name: EffectName): HTMLAudioElement {
  let audio = loadedEffects.get(name)
  if (!audio) {
    audio = new Audio(soundUrl(name))
    audio.preload = 'auto'
    loadedEffects.set(name, audio)
  }
  return audio
}

/** Loads the effects that play right on a click (placing a champion, rerolling), so they don't lag. */
export function preloadSounds(names: readonly EffectName[] = ['lock-in', 'reroll']): void {
  if (typeof Audio === 'undefined') return
  for (const name of names) loadedEffect(name)
}

/** Plays a short League client sound, unless effects are muted. Never throws. */
export function playSound(name: EffectName): void {
  if (!settings.effects || typeof Audio === 'undefined') return
  const audio = loadedEffect(name).cloneNode() as HTMLAudioElement
  audio.volume = EFFECTS_VOLUME
  audio.play().catch(() => {
    // The browser blocked it (no click yet) or the file failed: the game works fine without sound.
  })
}

const retryMusic = () => {
  if (settings.music) syncMusic()
}

/**
 * Starts or stops the looping draft music to match the settings. A player that failed (blocked,
 * or a broken load) is thrown away, so turning music on again always gets a fresh one.
 */
function syncMusic(): void {
  if (typeof Audio === 'undefined') return
  if (!settings.music) {
    musicPlayer?.pause()
    return
  }
  if (!musicPlayer || musicPlayer.error) {
    musicPlayer = Object.assign(new Audio(soundUrl('music')), { loop: true, volume: MUSIC_VOLUME })
  }
  const player = musicPlayer
  player.play().catch(() => {
    // Browsers only allow music after a click or tap; try again on the next one.
    if (musicPlayer === player && player.paused) musicPlayer = null
    window.addEventListener('pointerdown', retryMusic, { once: true })
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
    // One voice at a time: a new champion cuts off the last one's speech.
    if (currentVoice && currentVoice !== audio) currentVoice.pause()
    currentVoice = audio
    audio.play().catch(() => {
      // Blocked or missing: the roll works fine without the voice.
    })
  }
}

let currentVoice: HTMLAudioElement | null = null

/** Short UI sounds made in the browser (no files): the item roll's whoosh, ticks and landing. */
export type SynthSound = 'roll' | 'tick' | 'land'

let audioContext: AudioContext | null = null
const SYNTH_VOLUME = 0.05

/** Plays a tiny synthesized sound, unless effects are muted. Never throws. */
export function playSynth(sound: SynthSound): void {
  if (!settings.effects || typeof AudioContext === 'undefined') return
  try {
    audioContext ??= new AudioContext()
    const context = audioContext
    const now = context.currentTime
    const gain = context.createGain()
    gain.connect(context.destination)
    const oscillator = context.createOscillator()
    oscillator.connect(gain)
    if (sound === 'tick') {
      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(1400 + Math.random() * 300, now)
      gain.gain.setValueAtTime(SYNTH_VOLUME * 0.35, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03)
      oscillator.start(now)
      oscillator.stop(now + 0.035)
    } else if (sound === 'roll') {
      oscillator.type = 'sawtooth'
      oscillator.frequency.setValueAtTime(220, now)
      oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.25)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(SYNTH_VOLUME * 0.6, now + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
      oscillator.start(now)
      oscillator.stop(now + 0.32)
    } else {
      oscillator.type = 'triangle'
      oscillator.frequency.setValueAtTime(660, now)
      oscillator.frequency.setValueAtTime(990, now + 0.06)
      gain.gain.setValueAtTime(SYNTH_VOLUME, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
      oscillator.start(now)
      oscillator.stop(now + 0.24)
    }
  } catch {
    // No Web Audio: the game works fine without these.
  }
}

/** Music stops as soon as the tab is hidden (phone locked, app switched) and comes back with it. */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) musicPlayer?.pause()
    else syncMusic()
  })
}
