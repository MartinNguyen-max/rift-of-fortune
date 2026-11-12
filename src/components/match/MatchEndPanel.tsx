import { motion } from 'framer-motion'
import { championIconUrl } from '../../data'
import { BOT_PROFILES, type BotLevel } from '../../game/match/bots'
import { CASTER_NAMES, describeEvent, formatGameTime, type MatchLines } from '../../game/match/commentary'
import { formatKda, matchShareText, type MatchSummary } from '../../game/match/summary'
import type { MatchResult, MatchTeams } from '../../game/match/types'
import { ROLE_LABELS } from '../../game/roles'
import { Button } from '../Button'
import { ShareButton } from '../ShareButton'
import { routeHref } from '../useHashRoute'
import { eventIcon } from './matchStyles'

interface MatchEndPanelProps {
  match: MatchResult
  teams: MatchTeams
  lines: MatchLines
  summary: MatchSummary
  level: BotLevel
  onRematch: (level: BotLevel) => void
  onNewTeam: () => void
}

/** Victory or Defeat, the MVP, the moment of the match and what to do next. */
export function MatchEndPanel({ match, teams, lines, summary, level, onRematch, onNewTeam }: MatchEndPanelProps) {
  const won = match.winner === 'blue'
  const last = match.events[match.events.length - 1]
  const mvp = teams[summary.mvp.side].rating.champions.find(({ role }) => role === summary.mvp.role)
  const moment = summary.momentIndex === null ? null : match.events[summary.momentIndex]
  const momentLine = summary.momentIndex === null ? null : (lines[summary.momentIndex] ?? null)
  const nextLevel = won && level < 3 ? ((level + 1) as BotLevel) : null
  const url = `${window.location.origin}${window.location.pathname}${routeHref('match')}`
  const shareText = matchShareText(match, teams, summary, BOT_PROFILES[level].label, url)

  return (
    <motion.section
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 14 }}
      className="flex flex-col gap-4 rounded-xl border-2 border-gold/50 bg-panel/90 p-4 text-center shadow-2xl shadow-black/60"
    >
      <div>
        <h2 className={`font-display text-5xl font-black tracking-wider ${won ? 'text-gold' : 'text-red-400'}`}>
          {won ? 'Victory' : 'Defeat'}
        </h2>
        <p className="text-sm text-gold-light/70">
          {last?.kind === 'surrender'
            ? `${teams[last.side === 'blue' ? 'red' : 'blue'].name} surrendered at ${formatGameTime(match.duration)}`
            : `Nexus destroyed at ${formatGameTime(match.duration)}`}
        </p>
      </div>

      {mvp && (
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

      {moment && (
        <div className="rounded-lg border border-hextech/30 bg-hextech/5 p-3 text-left">
          <p className="mb-1 text-[10px] tracking-widest text-hextech uppercase">
            Moment of the match · {formatGameTime(moment.time)}
          </p>
          <p className="text-sm text-gold-light/90">
            <span aria-hidden="true">{eventIcon(moment)} </span>
            {momentLine && !momentLine.callback ? momentLine.text : describeEvent(moment, teams)}
          </p>
        </div>
      )}

      {summary.bestLine && summary.bestLine !== momentLine && (
        <blockquote className="text-sm text-gold-light/80 italic">
          “{summary.bestLine.text}”
          <footer className="mt-1 text-xs text-gold/60 not-italic">— {CASTER_NAMES[summary.bestLine.caster]}</footer>
        </blockquote>
      )}

      <div className="flex flex-col items-center gap-3">
        {nextLevel ? (
          <Button onClick={() => onRematch(nextLevel)}>Fight {BOT_PROFILES[nextLevel].label}</Button>
        ) : (
          <Button onClick={() => onRematch(level)}>Rematch</Button>
        )}
        <ShareButton text={shareText} />
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          {nextLevel && (
            <button type="button" onClick={() => onRematch(level)} className="text-hextech underline-offset-4 hover:underline">
              Rematch {BOT_PROFILES[level].label}
            </button>
          )}
          <button type="button" onClick={onNewTeam} className="text-hextech underline-offset-4 hover:underline">
            Draft a new team
          </button>
        </div>
      </div>
    </motion.section>
  )
}
