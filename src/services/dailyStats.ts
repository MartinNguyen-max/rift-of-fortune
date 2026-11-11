import type { DailyStats } from '../game/daily'

/**
 * Global Daily stats, stored in Supabase (see supabase/daily-scores.sql).
 * Optional: without the two env variables the Daily works, just without the comparison.
 * Uses Supabase's REST API directly, so no client library is needed.
 */
export interface DailyStatsConfig {
  url: string
  key: string
}

export function dailyStatsConfig(): DailyStatsConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  return url && key ? { url: url.replace(/\/$/, ''), key } : null
}

type Fetch = typeof fetch

const headers = (key: string) => ({ apikey: key, 'Content-Type': 'application/json' })

/** Saves today's score. A second score from the same player on the same day is ignored. */
export async function submitDailyScore(
  config: DailyStatsConfig,
  entry: { day: number; playerId: string; score: number },
  fetchFn: Fetch = fetch,
): Promise<void> {
  const response = await fetchFn(`${config.url}/rest/v1/daily_scores`, {
    method: 'POST',
    headers: { ...headers(config.key), Prefer: 'return=minimal' },
    body: JSON.stringify({ day: entry.day, player_id: entry.playerId, score: entry.score }),
  })
  // 409: already submitted today, which is fine.
  if (!response.ok && response.status !== 409) throw new Error(`Submitting score failed: ${response.status}`)
}

interface StatsRow {
  players: number
  beaten: number
}

const isStatsRow = (value: unknown): value is StatsRow =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as StatsRow).players === 'number' &&
  typeof (value as StatsRow).beaten === 'number'

/** How many players played today and how many of them scored lower than `score`. */
export async function fetchDailyStats(
  config: DailyStatsConfig,
  day: number,
  score: number,
  fetchFn: Fetch = fetch,
): Promise<DailyStats> {
  const response = await fetchFn(`${config.url}/rest/v1/rpc/daily_stats`, {
    method: 'POST',
    headers: headers(config.key),
    body: JSON.stringify({ p_day: day, p_score: score }),
  })
  if (!response.ok) throw new Error(`Loading stats failed: ${response.status}`)
  const body: unknown = await response.json()
  const row: unknown = Array.isArray(body) ? body[0] : body
  if (!isStatsRow(row)) throw new Error('Unexpected stats response')
  return { players: row.players, beaten: row.beaten }
}
