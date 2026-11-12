import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { championIconUrl, endOfGameIconUrl, mapIconUrl } from '../../data'
import { formatGameTime, type MatchLines } from '../../game/match/commentary'
import { formatKda, type MatchSummary } from '../../game/match/summary'
import type { MatchResult, MatchTeams, Side } from '../../game/match/types'
import { LIVE_EVENTS, LIVE_EVENT_TITLES } from '../../game/multiplayer/liveEvents'
import type { RoundState } from '../../game/multiplayer/session'
import { ROLE_LABELS } from '../../game/roles'
import { Button } from '../Button'
import { routeHref } from '../useHashRoute'
import { SeriesScore } from './SeriesScore'
import type { Room } from './useRoom'

interface LiveEndPanelProps {
  room: Room
  round: RoundState
  mySide: Side
  won: boolean
  /** The finished match as watched (reel events), or null after a surrender. */
  match: MatchResult | null
  /** Your team on blue. */
  teams: MatchTeams
  lines: MatchLines
  summary: MatchSummary | null
  story: string
}

/** On phones the result is below the map: scroll to it once the ending has played. */
const SCROLL_DELAY_MS = 1200

const EVENT_ICONS = { gank: '🗡️', teamfight: '💥', baron: 'baron', elder: 'elder' } as const

/** Victory or Defeat, how the mini-games went, and a rematch with new teams. */
export function LiveEndPanel({ room, round, mySide, won, match, teams, summary, story }: LiveEndPanelProps) {
  const { me, opponent, setReady, leaveRound, wins } = room
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!window.matchMedia('(max-width: 1023px)').matches) return
    const id = window.setTimeout(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), SCROLL_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [])
  const opponentInfo = round.players.find(({ id }) => id !== me.id)
  const opponentHere = opponent !== null && opponent.id === opponentInfo?.id
  const last = match?.events[match.events.length - 1]
  const mvp = summary && teams[summary.mvp.side].rating.champions.find(({ role }) => role === summary.mvp.role)

  const howItEnded = round.surrendered
    ? round.surrendered === me.id
      ? 'You surrendered.'
      : `${opponentInfo?.name ?? 'Your opponent'} surrendered.`
    : last?.kind === 'surrender'
      ? `${teams[last.side === 'blue' ? 'red' : 'blue'].name} surrendered at ${formatGameTime(match?.duration ?? 0)}`
      : `Nexus destroyed at ${formatGameTime(match?.duration ?? 0)}`

  return (
    <motion.section
      ref={panel}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 14 }}
      className="flex flex-col gap-4 rounded-xl border-2 border-gold/50 bg-panel/90 p-4 text-center shadow-2xl shadow-black/60"
    >
      <div className="flex flex-col items-center">
        <motion.img
          src={endOfGameIconUrl(won ? 'victory' : 'defeat')}
          alt=""
          className={`-mb-1 size-20 drop-shadow-[0_0_18px_rgb(200_170_110/0.45)] sm:size-24 ${won ? '' : 'grayscale-[30%]'}`}
          initial={{ scale: 0.3, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.1 }}
        />
        <h2 className={`font-display text-5xl font-black tracking-wider ${won ? 'text-gold' : 'text-red-400'}`}>
          {won ? 'Victory' : 'Defeat'}
        </h2>
        <p className="text-sm text-gold-light/70">{howItEnded}</p>
      </div>

      <LiveEventsSummary round={round} mySide={mySide} />

      {story && (
        <div className="rounded-lg border border-gold/30 bg-abyss/50 p-3 text-left">
          <p className="mb-1 text-[10px] tracking-widest text-gold/70 uppercase">How it went</p>
          <p className="text-sm leading-relaxed text-gold-light/90">{story}</p>
        </div>
      )}

      {summary && mvp && (
        <div className="flex items-center justify-center gap-3">
          <img src={championIconUrl(mvp.champion.image)} alt="" className="size-12 rounded-full border-2 border-gold" />
          <div className="text-left">
            <p className="text-[10px] tracking-widest text-gold/70 uppercase">{won ? 'MVP' : 'Enemy MVP'}</p>
            <p className="font-display font-bold text-gold-light">
              {mvp.champion.name} <span className="text-xs text-gold-light/60">{ROLE_LABELS[mvp.role]}</span>
            </p>
            <p className="font-mono text-sm text-gold-light/80">{formatKda(summary.mvp.kda)}</p>
          </div>
        </div>
      )}

      {opponentInfo && <SeriesScore me={me} opponent={opponentInfo} wins={wins} />}

      <div className="flex flex-col items-center gap-2">
        {opponentHere ? (
          <>
            <Button onClick={() => setReady(!me.ready)} className={me.ready ? 'bg-gold/20' : ''}>
              {me.ready ? 'Rematch ✓' : 'Rematch'}
            </Button>
            <p className="text-sm text-gold-light/70" aria-live="polite">
              {me.ready && opponent.ready
                ? 'Starting a new draft…'
                : opponent.ready
                  ? `${opponent.name} wants a rematch!`
                  : me.ready
                    ? `Waiting for ${opponent.name}…`
                    : 'New teams, same lobby.'}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-gold-light/70">Your opponent left the lobby.</p>
            <Button onClick={leaveRound}>Back to lobby</Button>
          </>
        )}
        <a href={routeHref('play')} className="text-sm text-hextech underline-offset-4 hover:underline">
          Leave lobby
        </a>
      </div>
    </motion.section>
  )
}

function LiveEventsSummary({ round, mySide }: { round: RoundState; mySide: Side }) {
  const played = LIVE_EVENTS.flatMap(({ kind }, index) => {
    const result = round.events[index]?.result
    return result ? [{ kind, result }] : []
  })
  if (played.length === 0) return null
  const theirSide: Side = mySide === 'blue' ? 'red' : 'blue'

  return (
    <ul className="flex flex-col gap-1 rounded-lg border border-hextech/30 bg-hextech/5 p-2 text-left text-sm">
      <li className="px-1 text-[10px] tracking-widest text-hextech uppercase">Live events</li>
      {played.map(({ kind, result }) => {
        const icon = EVENT_ICONS[kind]
        const won = result.winner === mySide
        return (
          <li key={kind} className="flex items-center gap-2 px-1">
            {icon === 'baron' || icon === 'elder' ? (
              <img src={mapIconUrl(icon)} alt="" className="size-5 object-contain" />
            ) : (
              <span aria-hidden="true" className="w-5 text-center">
                {icon}
              </span>
            )}
            <span className="flex-1 text-gold-light/90">{LIVE_EVENT_TITLES[kind].replace('!', '')}</span>
            {result.scores && (
              <span className="font-mono text-xs text-gold-light/60">
                {result.scores[mySide]}–{result.scores[theirSide]}
              </span>
            )}
            <span className={`w-12 text-right font-bold ${won ? 'text-hextech' : 'text-red-400'}`}>{won ? 'Won' : 'Lost'}</span>
          </li>
        )
      })}
    </ul>
  )
}
