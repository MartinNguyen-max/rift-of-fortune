import { motion } from 'framer-motion'
import { championIconUrl, itemIconUrl, rankEmblemUrl } from '../../data'
import type { MatchTeam, MatchTeams, Side } from '../../game/match/types'
import { ROLE_LABELS } from '../../game/roles'
import { ITEM_FIT_THRESHOLDS } from '../../game/scoring/config'
import { rankLabel } from '../../game/scoring/rank'
import { Button } from '../Button'
import { SIDE_TEXT } from './matchStyles'

interface VersusPanelProps {
  teams: MatchTeams
  botLabel: string
  onStart: () => void
}

/** Both teams side by side before the match starts. */
export function VersusPanel({ teams, botLabel, onStart }: VersusPanelProps) {
  return (
    <section className="flex w-full max-w-3xl flex-col items-center gap-5">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-4">
        <TeamCard team={teams.blue} side="blue" subtitle="Blue side" delay={0} />
        <motion.span
          initial={{ scale: 3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 12 }}
          className="self-center font-display text-3xl font-black text-gold sm:text-5xl"
        >
          VS
        </motion.span>
        <TeamCard team={teams.red} side="red" subtitle={`${botLabel} bot`} delay={0.2} />
      </div>
      <Button onClick={onStart} className="text-lg">
        Start the match
      </Button>
    </section>
  )
}

interface TeamCardProps {
  team: MatchTeam
  side: Side
  subtitle: string
  delay: number
}

function TeamCard({ team, side, subtitle, delay }: TeamCardProps) {
  const { rating } = team
  return (
    <motion.article
      initial={{ x: side === 'blue' ? -30 : 30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay }}
      className="flex min-w-0 flex-col items-center gap-2 rounded-xl border border-gold/30 bg-panel/70 p-3 text-center shadow-2xl shadow-black/50 backdrop-blur sm:p-4"
    >
      <p className="text-[10px] tracking-widest text-gold/60 uppercase">{subtitle}</p>
      <h2 className={`max-w-full truncate font-display text-base font-black sm:text-xl ${SIDE_TEXT[side]}`}>{team.name}</h2>
      <img src={rankEmblemUrl(rating.rank.tier)} alt="" className="-my-2 size-20 object-contain sm:size-28" />
      <p className="font-display font-bold text-gold-light">
        {rankLabel(rating.rank)} · {rating.score}
      </p>
      <ul className="flex w-full flex-col gap-1.5">
        {rating.champions.map(({ role, champion, items }) => {
          const itemIcons = items.map(({ item, fit }) => (
            <img
              key={item.id}
              src={itemIconUrl(item.image)}
              alt={item.name}
              title={item.name}
              className={`size-5 rounded border sm:size-7 ${fit <= ITEM_FIT_THRESHOLDS.bad ? 'border-red-500' : 'border-gold/40'}`}
            />
          ))
          return (
            <li key={role} className="flex items-center gap-2 text-left">
              <img src={championIconUrl(champion.image)} alt="" className="size-7 shrink-0 rounded-full border border-gold/60" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-gold-light">{champion.name}</span>
                <span className="hidden text-[10px] text-gold-light/50 uppercase sm:block">{ROLE_LABELS[role]}</span>
                <span className="mt-0.5 flex gap-0.5 sm:hidden">{itemIcons}</span>
              </span>
              <span className="hidden shrink-0 gap-0.5 sm:flex">{itemIcons}</span>
            </li>
          )
        })}
      </ul>
    </motion.article>
  )
}
