import { motion } from 'framer-motion'
import { championIconUrl } from '../../data'
import type { ChampionRef, ChampionStats, MatchTeams, Side } from '../../game/match/types'
import { formatKda } from '../../game/match/summary'
import { ROLE_LABELS, ROLES } from '../../game/roles'
import { SIDE_TEXT } from './matchStyles'

interface ChampionScoreboardProps {
  teams: MatchTeams
  stats: ChampionStats
  /** Shown at the end: the MVP gets a crown, the champion who died the most a skull. */
  awards?: { mvp: ChampionRef; feeder: ChampionRef | null }
}

const sameChampion = (a: ChampionRef | null | undefined, side: Side, role: ChampionRef['role']) =>
  a?.side === side && a.role === role

/** Every champion's K/D/A, live. Rows flash when their numbers change. */
export function ChampionScoreboard({ teams, stats, awards }: ChampionScoreboardProps) {
  return (
    <section aria-label="Champion scores" className="grid grid-cols-2 gap-2 rounded-xl border border-gold/20 bg-abyss/60 p-2">
      {(['blue', 'red'] as const).map((side) => (
        <ol key={side} className="flex flex-col gap-1">
          <li className={`truncate px-1 text-[10px] font-semibold tracking-widest uppercase ${SIDE_TEXT[side]} ${side === 'red' ? 'text-right' : ''}`}>
            {teams[side].name}
          </li>
          {ROLES.map((role) => {
            const champion = teams[side].rating.champions.find((entry) => entry.role === role)
            if (!champion) return null
            const kda = stats[side][role]
            const award = sameChampion(awards?.mvp, side, role) ? '👑' : sameChampion(awards?.feeder, side, role) ? '💀' : null
            return (
              <motion.li
                key={`${role}-${kda.kills}-${kda.deaths}-${kda.assists}`}
                initial={{ backgroundColor: 'rgba(200, 170, 110, 0.35)' }}
                animate={{ backgroundColor: 'rgba(200, 170, 110, 0)' }}
                transition={{ duration: 0.8 }}
                className={`flex items-center gap-1.5 rounded-md px-1 py-0.5 ${side === 'red' ? 'flex-row-reverse text-right' : ''}`}
              >
                <span className="relative shrink-0">
                  <img
                    src={championIconUrl(champion.champion.image)}
                    alt=""
                    className={`size-7 rounded-full border ${side === 'blue' ? 'border-hextech/60' : 'border-red-400/60'}`}
                  />
                  {award && (
                    <span className="absolute -top-2 -right-1 text-sm" aria-label={award === '👑' ? 'MVP' : 'Most deaths'}>
                      {award}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-gold-light/80" title={`${champion.champion.name} (${ROLE_LABELS[role]})`}>
                  {champion.champion.name}
                </span>
                <span className="shrink-0 font-mono text-xs font-semibold text-gold-light tabular-nums">{formatKda(kda)}</span>
              </motion.li>
            )
          })}
        </ol>
      ))}
    </section>
  )
}
