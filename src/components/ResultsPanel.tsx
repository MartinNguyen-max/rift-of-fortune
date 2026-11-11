import { motion } from 'framer-motion'
import { championIconUrl, itemIconUrl } from '../data'
import { ROLE_LABELS } from '../game/roles'
import type { ChampionRating, TeamRating } from '../game/scoring/rateTeam'
import { scoreColor } from './scoreColor'

interface ResultsPanelProps {
  rating: TeamRating
}

export function ResultsPanel({ rating }: ResultsPanelProps) {
  return (
    <section className="flex flex-col gap-6">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12 }}
        className="text-center"
      >
        <h2 className="text-sm font-semibold tracking-widest text-gold/80 uppercase">Team rating</h2>
        <p className={`text-7xl font-black ${scoreColor(rating.score)}`}>{rating.grade}</p>
        <p className="text-2xl font-bold text-gold-light">{rating.score} / 100</p>
        <p className="mt-2 text-gold-light/80 italic">{rating.summary}</p>
      </motion.div>

      <div>
        <h3 className="mb-2 text-xs font-semibold tracking-widest text-gold/80 uppercase">
          Team balance · {rating.balance.score}
        </h3>
        <ul className="flex flex-col gap-1 text-sm">
          {rating.balance.checks.map((check) => (
            <li key={check.id} className="flex gap-2">
              <span className={check.passed ? 'text-emerald-400' : 'text-red-400'}>{check.passed ? '✓' : '✗'}</span>
              <span className="text-gold-light/90">{check.message}</span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="flex flex-col gap-3">
        {rating.champions.map((championRating, index) => (
          <motion.li
            key={championRating.role}
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 + index * 0.12 }}
          >
            <ChampionResult rating={championRating} />
          </motion.li>
        ))}
      </ul>
    </section>
  )
}

function ChampionResult({ rating }: { rating: ChampionRating }) {
  const { champion, role, roleFit, itemFit, score, items, feedback } = rating

  return (
    <article className="rounded-lg border border-gold/20 bg-abyss/60 p-3">
      <header className="flex items-center gap-3">
        <img src={championIconUrl(champion.image)} alt="" className="size-10 rounded-full border border-gold" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-gold-light">{champion.name}</p>
          <p className="text-xs text-gold-light/60">
            {ROLE_LABELS[role]} · role {roleFit.score} · items {itemFit}
          </p>
        </div>
        <div className="flex gap-1">
          {items.map(({ item, fit }) => (
            <img
              key={item.id}
              src={itemIconUrl(item.image)}
              alt={item.name}
              title={`${item.name}: fit ${fit}`}
              className="size-7 rounded border border-gold/50"
            />
          ))}
        </div>
        <p className={`w-10 text-right text-2xl font-black ${scoreColor(score)}`}>{score}</p>
      </header>
      <ul className="mt-2 flex flex-col gap-0.5 text-sm text-gold-light/80">
        {feedback.map((line) => (
          <li key={line}>· {line}</li>
        ))}
      </ul>
    </article>
  )
}
