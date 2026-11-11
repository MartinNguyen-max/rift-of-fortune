import { useEffect, useState } from 'react'
import { beatenShare, shareText, type DailyStats } from '../game/daily'
import type { TeamRating } from '../game/scoring/rateTeam'
import { dailyStatsConfig, fetchDailyStats, submitDailyScore } from '../services/dailyStats'
import { playerId } from '../services/storage'
import { Button } from './Button'
import { Countdown } from './Countdown'
import { routeHref } from './useHashRoute'

interface DailyResultProps {
  number: number
  rating: TeamRating
}

type StatsState = { status: 'off' } | { status: 'loading' } | { status: 'done'; stats: DailyStats } | { status: 'error' }

/** Daily results extras: how you compare to today's players, Share, and the countdown. */
export function DailyResult({ number, rating }: DailyResultProps) {
  const [stats, setStats] = useState<StatsState>(() => (dailyStatsConfig() ? { status: 'loading' } : { status: 'off' }))
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    const config = dailyStatsConfig()
    if (!config) return
    let cancelled = false
    submitDailyScore(config, { day: number, playerId: playerId(), score: rating.score })
      .then(() => fetchDailyStats(config, number, rating.score))
      .then((result) => !cancelled && setStats({ status: 'done', stats: result }))
      .catch(() => !cancelled && setStats({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [number, rating.score])

  const text = shareText(
    number,
    rating,
    `${window.location.origin}${window.location.pathname}${routeHref('daily')}`,
    stats.status === 'done' ? stats.stats : null,
  )
  const share = () => {
    navigator.clipboard.writeText(text).then(
      () => setShareStatus('copied'),
      () => setShareStatus('failed'),
    )
  }

  return (
    <>
      <StatsLine stats={stats} />
      <Button onClick={share}>{shareStatus === 'copied' ? 'Copied!' : 'Share result'}</Button>
      {shareStatus === 'failed' && (
        <pre className="w-full rounded border border-gold/30 bg-abyss/60 p-2 text-left text-xs whitespace-pre-wrap text-gold-light/80 select-all">
          {text}
        </pre>
      )}
      <p className="text-sm text-gold-light/70">
        Next Daily in <Countdown />
      </p>
      <a href={routeHref('classic')} className="text-sm text-hextech underline-offset-4 hover:underline">
        Can&apos;t wait? Play Classic
      </a>
    </>
  )
}

function StatsLine({ stats }: { stats: StatsState }) {
  if (stats.status === 'off') return null
  if (stats.status === 'loading') return <p className="text-sm text-gold-light/60">Comparing with today&apos;s players…</p>
  if (stats.status === 'error') return <p className="text-sm text-gold-light/60">Couldn&apos;t load today&apos;s stats.</p>

  const share = beatenShare(stats.stats)
  return (
    <p className="text-sm text-gold-light/90">
      {share === null ? (
        "You're the first to play today!"
      ) : (
        <>
          You beat <span className="font-bold text-gold">{share}%</span> of {stats.stats.players.toLocaleString()}{' '}
          players today.
        </>
      )}
    </p>
  )
}
