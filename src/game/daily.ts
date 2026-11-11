import type { Champion, Item, Role } from '../data/types'
import { drawItems } from './items'
import { sample, seededRandom, seedFromString } from './random'
import { ROLES } from './roles'
import { rankLabel } from './scoring/rank'
import type { TeamRating } from './scoring/rateTeam'

/** The first Daily Rift. Each day after it gets the next number. */
const DAILY_EPOCH = { year: 2026, month: 11, day: 11 }
const MS_PER_DAY = 24 * 60 * 60 * 1000
const TEAM_SIZE = ROLES.length

export interface DailyRolls {
  /** The five champions, in the order they are rolled. */
  champions: Champion[]
  /** The ten items, in the order they are rolled. */
  items: Item[]
}

const pad = (value: number) => String(value).padStart(2, '0')

/** The local calendar date, e.g. "2026-11-11". A new Daily starts at local midnight. */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Daily number: #1 on the first day, #2 the day after, and so on. */
export function dailyNumber(date: Date): number {
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const epoch = Date.UTC(DAILY_EPOCH.year, DAILY_EPOCH.month - 1, DAILY_EPOCH.day)
  return Math.round((today - epoch) / MS_PER_DAY) + 1
}

/** Everyone gets the same champions and items on the same day. */
export function dailyRolls(data: { champions: readonly Champion[]; items: readonly Item[] }, date: Date): DailyRolls {
  const random = seededRandom(seedFromString(`rift-roulette:${dateKey(date)}`))
  return { champions: sample(data.champions, TEAM_SIZE, random), items: drawItems(data.items, random) }
}

/** Milliseconds until the next Daily (local midnight). */
export function msUntilNextDaily(now: Date): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return midnight.getTime() - now.getTime()
}

/** "5h 04m 09s" */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`
}

const SHORT_ROLE: Record<Role, string> = { TOP: 'Top', JUNGLE: 'Jng', MIDDLE: 'Mid', BOTTOM: 'ADC', SUPPORT: 'Sup' }

/** Same thresholds as the score colours in the UI. */
export function scoreEmoji(score: number): string {
  if (score >= 75) return '🟩'
  if (score >= 50) return '🟨'
  return '🟥'
}

/** "Beat 64% of players" */
export function beatenShare(stats: DailyStats): number | null {
  const others = stats.players - 1
  return others > 0 ? Math.round((stats.beaten / others) * 100) : null
}

export interface DailyStats {
  /** Players who submitted a score today, including you. */
  players: number
  /** Players with a lower score than yours. */
  beaten: number
}

/** Spoiler-free share text: rank, score and a coloured square per role, but no champion names. */
export function shareText(number: number, rating: TeamRating, url: string, stats?: DailyStats | null): string {
  const roles = rating.champions.map(({ role, score }) => `${SHORT_ROLE[role]} ${scoreEmoji(score)}`).join(' ')
  const share = stats ? beatenShare(stats) : null
  return [
    `LoL Rift Roulette · Daily #${number}`,
    `${rankLabel(rating.rank)} · ${rating.score}/100`,
    roles,
    ...(share === null ? [] : [`Beat ${share}% of players today`]),
    url,
  ].join('\n')
}
