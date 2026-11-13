import { DndContext } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { rankEmblemUrl } from '../../data'
import type { MatchTeam, MatchTeams, Side } from '../../game/match/types'
import { rankLabel } from '../../game/scoring/rank'
import { playSound } from '../../services/sound'
import { SIDE_TEXT } from '../match/matchStyles'
import { RiftMap } from '../RiftMap'
import { RoleSlot } from '../RoleSlot'
import { useCountdown } from '../useCountdown'

interface VersusScreenProps {
  /** Your team on blue. */
  teams: MatchTeams
  /** When the match starts (a Date.now() timestamp). */
  deadline: number
  onDone: () => void
}

/** Both drafted teams on their maps, with ranks and ratings, then a countdown into the match. */
export function VersusScreen({ teams, deadline, onDone }: VersusScreenProps) {
  const remaining = useCountdown(deadline)
  const seconds = Math.ceil(remaining)
  const done = remaining <= 0
  const started = useRef(false)

  useEffect(() => {
    if (done && !started.current) {
      started.current = true
      playSound('match-start')
      onDone()
    }
  }, [done, onDone])

  return (
    <section className="flex w-full flex-col items-center gap-4">
      <div className="flex items-center gap-3" role="timer" aria-label={`Match starts in ${seconds} seconds`}>
        <span className="text-sm tracking-widest text-gold/70 uppercase">Match starts in</span>
        <AnimatePresence mode="popLayout">
          <motion.span
            key={seconds}
            initial={{ scale: 1.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="w-10 text-center font-display text-4xl font-black text-gold tabular-nums"
          >
            {seconds}
          </motion.span>
        </AnimatePresence>
      </div>
      {/* The map slots use drag-and-drop hooks, which need a context even when nothing can be dragged. */}
      <DndContext>
        <div className="grid w-full items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <TeamBoard team={teams.blue} side="blue" label="Your team" />
          <motion.span
            initial={{ scale: 3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 12 }}
            className="text-center font-display text-4xl font-black text-gold sm:text-5xl"
          >
            VS
          </motion.span>
          <TeamBoard team={teams.red} side="red" label="Opponent" />
        </div>
      </DndContext>
    </section>
  )
}

function TeamBoard({ team, side, label }: { team: MatchTeam; side: Side; label: string }) {
  const { rating } = team
  return (
    <motion.article
      initial={{ x: side === 'blue' ? -30 : 30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: side === 'blue' ? 0 : 0.2 }}
      className="flex min-w-0 flex-col items-center gap-2 rounded-xl border border-gold/30 bg-panel/70 p-3 shadow-2xl shadow-black/50 backdrop-blur"
    >
      <div className="flex w-full items-center justify-center gap-3">
        <img src={rankEmblemUrl(rating.rank.tier)} alt="" className="-my-2 size-16 shrink-0 object-contain sm:size-20" />
        <div className="min-w-0 text-left">
          <p className="text-[10px] tracking-widest text-gold/60 uppercase">{label}</p>
          <h2 className={`leading-tight [overflow-wrap:anywhere] font-display text-lg font-black sm:text-xl ${SIDE_TEXT[side]}`}>{team.name}</h2>
          <p className="font-display font-bold whitespace-nowrap text-gold-light">
            {rankLabel(rating.rank)} · {rating.score}
          </p>
        </div>
      </div>
      <RiftMap
        renderSlot={(role) => {
          const champion = rating.champions.find((entry) => entry.role === role)
          return (
            <RoleSlot
              role={role}
              champion={champion?.champion ?? null}
              items={champion?.items.map(({ item }) => item) ?? []}
              droppable={false}
              highlighted={false}
              score={champion?.score}
            />
          )
        }}
      />
    </motion.article>
  )
}
