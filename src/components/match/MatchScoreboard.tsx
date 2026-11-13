import { mapIconUrl } from '../../data'
import { formatGameTime } from '../../game/match/commentary'
import type { MatchTeams, Scoreboard, Side } from '../../game/match/types'
import { formatGold, SIDE_TEXT } from './matchStyles'

interface MatchScoreboardProps {
  teams: MatchTeams
  score: Scoreboard
  clock: number
  /** Only names, kills and the clock (Multiplayer keeps the screen calm). */
  compact?: boolean
}

export function MatchScoreboard({ teams, score, clock, compact = false }: MatchScoreboardProps) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-gold/30 bg-panel/80 p-3 shadow-2xl shadow-black/50 backdrop-blur">
      <TeamScore side="blue" name={teams.blue.name} score={score} compact={compact} />
      <div className="flex flex-col items-center">
        <span className="font-mono text-lg font-bold text-gold-light tabular-nums">{formatGameTime(clock)}</span>
        <span className="text-[10px] tracking-widest text-gold/60 uppercase">Kills</span>
      </div>
      <TeamScore side="red" name={teams.red.name} score={score} compact={compact} />
    </div>
  )
}

function TeamScore({ side, name, score, compact }: { side: Side; name: string; score: Scoreboard; compact: boolean }) {
  const { kills, towers, dragons, gold } = score[side]
  const alignRight = side === 'red'
  return (
    <div className={`flex min-w-0 flex-col ${alignRight ? 'items-end text-right' : 'items-start'}`}>
      <span className={`max-w-full leading-tight [overflow-wrap:anywhere] text-xs font-semibold ${SIDE_TEXT[side]}`}>{name}</span>
      <span className={`font-display text-3xl leading-tight font-black tabular-nums ${SIDE_TEXT[side]}`}>{kills}</span>
      {!compact && (
        <span className={`flex gap-2 text-xs text-gold-light/80 tabular-nums ${alignRight ? 'flex-row-reverse' : ''}`}>
          <span title="Towers" className="flex items-center gap-0.5">
            <img src={mapIconUrl('tower')} alt="" className="size-4 object-contain" />
            {towers}
          </span>
          <span title="Dragons" className="flex items-center gap-0.5">
            <img src={mapIconUrl('dragon')} alt="" className="size-4 object-contain" />
            {dragons}
          </span>
          <span title="Gold">💰{formatGold(gold)}</span>
        </span>
      )}
    </div>
  )
}
