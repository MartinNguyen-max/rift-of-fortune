import { describe, expect, it, vi } from 'vitest'
import { fetchDailyStats, submitDailyScore } from './dailyStats'

const config = { url: 'https://example.supabase.co', key: 'sb_publishable_test' }

const respond = (status: number, body: unknown = null) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(body === null ? null : JSON.stringify(body), { status }))

describe('submitDailyScore', () => {
  const entry = { day: 3, playerId: 'abc', score: 61 }

  it('posts the score to the daily_scores table', async () => {
    const fetchFn = respond(201)
    await submitDailyScore(config, entry, fetchFn)
    const [url, init] = fetchFn.mock.calls[0] ?? []
    expect(url).toBe('https://example.supabase.co/rest/v1/daily_scores')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({ apikey: 'sb_publishable_test' })
    expect(JSON.parse(String(init?.body))).toEqual({ day: 3, player_id: 'abc', score: 61 })
  })

  it('ignores a second submission on the same day', async () => {
    await expect(submitDailyScore(config, entry, respond(409))).resolves.toBeUndefined()
  })

  it('throws on other errors', async () => {
    await expect(submitDailyScore(config, entry, respond(500))).rejects.toThrow('500')
  })
})

describe('fetchDailyStats', () => {
  it('reads players and beaten from the daily_stats function', async () => {
    const fetchFn = respond(200, [{ players: 12, beaten: 7 }])
    await expect(fetchDailyStats(config, 3, 61, fetchFn)).resolves.toEqual({ players: 12, beaten: 7 })
    const [url, init] = fetchFn.mock.calls[0] ?? []
    expect(url).toBe('https://example.supabase.co/rest/v1/rpc/daily_stats')
    expect(JSON.parse(String(init?.body))).toEqual({ p_day: 3, p_score: 61 })
  })

  it('rejects an unexpected response', async () => {
    await expect(fetchDailyStats(config, 3, 61, respond(200, [{ nope: true }]))).rejects.toThrow('Unexpected')
  })
})
