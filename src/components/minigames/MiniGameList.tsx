import { motion } from 'framer-motion'
import { MINI_GAME_IDS, MINI_GAMES, type MiniGameInfo } from '../../game/minigames/catalog'
import { miniGameHref } from '../useHashRoute'
import { championIconById } from './miniGameArt'

export function MiniGameList() {
  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-6">
      <div className="text-center">
        <h2 className="font-display text-3xl font-black text-gold sm:text-4xl">Mini-games</h2>
        <p className="mt-1 text-sm text-gold-light/70">Quick fights against a bot. Soon against your friends.</p>
      </div>
      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MINI_GAME_IDS.map((id, index) => (
          <MiniGameCard key={id} info={MINI_GAMES[id]} delay={index * 0.06} />
        ))}
      </div>
    </div>
  )
}

function MiniGameCard({ info, delay }: { info: MiniGameInfo; delay: number }) {
  return (
    <motion.a
      href={miniGameHref(info.id)}
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay }}
      className="group flex items-center gap-4 rounded-xl border border-gold/30 bg-panel/70 p-4 shadow-xl shadow-black/40 transition hover:border-gold hover:shadow-gold/10"
    >
      <img
        src={championIconById(info.champion)}
        alt={info.champion}
        className="size-16 shrink-0 rounded-full border-2 border-gold/60 object-cover transition group-hover:scale-105 group-hover:border-gold"
      />
      <span className="flex flex-col gap-1">
        <span className="font-display text-lg leading-tight font-black text-gold">{info.name}</span>
        <span className="text-sm text-gold-light/75">{info.tagline}</span>
      </span>
    </motion.a>
  )
}
