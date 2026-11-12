import { motion } from 'framer-motion'
import { championIconUrl } from '../../data'
import { formatKda } from '../../game/match/summary'
import type { ChampionRef, ChampionStats, MatchTeams, Side } from '../../game/match/types'
import { ROLE_LABELS, ROLES } from '../../game/roles'
import { SIDE_TEXT } from './matchStyles'

interface ChampionScoreboardProps {
  teams: MatchTeams
  stats: ChampionStats
  /** The best player (👑) and the one who died the most (💀). */
  best: ChampionRef | null
  worst: ChampionRef | null
  /** At the end the crown means MVP; during the match it means "carrying right now". */
  final: boolean
}

const isChampion = (ref: ChampionRef | null, side: Side, role: ChampionRef['role']) => ref?.side === side && ref.role === role

/** Every champion's kills / deaths / assists, live, with the current carry and feeder marked. */
export function ChampionScoreboard({ teams, stats, best, worst, final }: ChampionScoreboardProps) {
  return (
    <section aria-label="Champion scores" className="rounded-xl border border-gold/20 bg-abyss/60 p-2">
      <div className="grid grid-cols-2 gap-2">
        {(['blue', 'red'] as const).map((side) => (
          <ol key={side} className="flex flex-col gap-1">
            <li className={`flex items-end justify-between gap-1 px-1 ${side === 'red' ? 'flex-row-reverse' : ''}`}>
              <span className={`leading-tight [overflow-wrap:anywhere] text-[10px] font-semibold tracking-widest uppercase ${SIDE_TEXT[side]}`}>{teams[side].name}</span>
              <span className="shrink-0 text-[10px] text-gold/60" title="Kills / Deaths / Assists">
                K/D/A
              </span>
            </li>
            {ROLES.map((role) => {
              const champion = teams[side].rating.champions.find((entry) => entry.role === role)
              if (!champion) return null
              const kda = stats[side][role]
              const isBest = isChampion(best, side, role)
              const isWorst = isChampion(worst, side, role)
              return (
                <motion.li
                  key={`${role}-${kda.kills}-${kda.deaths}-${kda.assists}`}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6 }}
                  className={`flex items-center gap-1.5 rounded-md px-1 py-0.5 ${side === 'red' ? 'flex-row-reverse text-right' : ''} ${
                    isBest ? 'bg-gold/15 ring-1 ring-gold/50' : isWorst ? 'bg-red-500/15 ring-1 ring-red-400/50' : ''
                  }`}
                >
                  <span className="relative shrink-0">
                    <img
                      src={championIconUrl(champion.champion.image)}
                      alt=""
                      className={`size-7 rounded-full border ${side === 'blue' ? 'border-hextech/60' : 'border-red-400/60'}`}
                    />
                    {(isBest || isWorst) && (
                      <motion.span
                        key={isBest ? 'best' : 'worst'}
                        initial={{ scale: 2 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-1 text-sm"
                        aria-label={isBest ? (final ? 'MVP' : 'Carrying') : 'Most deaths'}
                      >
                        {isBest ? '👑' : '💀'}
                      </motion.span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight [overflow-wrap:anywhere] text-xs text-gold-light/80" title={`${champion.champion.name} (${ROLE_LABELS[role]})`}>
                    {champion.champion.name}
                  </span>
                  <span className="shrink-0 font-mono text-xs font-semibold text-gold-light tabular-nums">{formatKda(kda)}</span>
                </motion.li>
              )
            })}
          </ol>
        ))}
      </div>
      <p className="mt-1.5 text-center text-[10px] text-gold-light/50">
        Kills / Deaths / Assists · 👑 {final ? 'MVP' : 'carrying'} · 💀 most deaths
      </p>
    </section>
  )
}
