import { motion } from 'framer-motion'
import { useState } from 'react'
import { MINI_GAME_IDS, MINI_GAMES, type MiniGameInfo } from '../../game/minigames/catalog'
import type { MiniGameRecord } from '../../game/minigames/records'
import { MINI_GAME_RULES } from '../../game/minigames/registry'
import { readRecords } from '../../services/miniGameRecords'
import { miniGameHref } from '../useHashRoute'
import { championIconById } from './miniGameArt'

export function MiniGameList() {
  const [records] = useState(readRecords)
  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-6">
      <div className="text-center">
        <h2 className="font-display text-3xl font-black text-gold sm:text-4xl">Mini-games</h2>
        <p className="mt-1 text-sm text-gold-light/70">Quick fights against a bot. In Multiplayer they are the live events.</p>
      </div>
      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MINI_GAME_IDS.map((id, index) => (
          <MiniGameCard key={id} info={MINI_GAMES[id]} record={records[id]} delay={index * 0.05} />
        ))}
      </div>
    </div>
  )
}

/** "Best 212 ms", "Best streak 3", or nothing before the first game. */
function recordLine(info: MiniGameInfo, record: MiniGameRecord | undefined): string | null {
  if (!record || record.played === 0) return null
  const best = MINI_GAME_RULES[info.id].best
  const parts = [
    best && record.best !== null ? `Best ${best.format(record.best)}` : null,
    record.bestStreak >= 2 ? `Streak ${record.bestStreak}` : null,
    `${record.wins}/${record.played} won`,
  ]
  return parts.filter((part) => part !== null).join(' · ')
}

function MiniGameCard({ info, record, delay }: { info: MiniGameInfo; record: MiniGameRecord | undefined; delay: number }) {
  const line = recordLine(info, record)
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
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-display text-lg leading-tight font-black text-gold">{info.name}</span>
        <span className="text-sm text-gold-light/75">{info.tagline}</span>
        {line && <span className="text-xs font-semibold text-hextech">🏆 {line}</span>}
      </span>
    </motion.a>
  )
}
