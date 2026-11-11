import { useDraggable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { championIconUrl } from '../data'
import type { Champion } from '../data/types'
import { ROLE_LABELS } from '../game/roles'

export const ROLLED_CHAMPION_ID = 'rolled-champion'

interface RolledChampionCardProps {
  champion: Champion
}

export function RolledChampionCard({ champion }: RolledChampionCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ROLLED_CHAMPION_ID })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
      className="flex flex-col items-center gap-3"
    >
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        aria-label={`Drag ${champion.name} onto a role`}
        className={`relative z-10 size-28 cursor-grab touch-none overflow-hidden rounded-xl border-2 border-gold shadow-lg shadow-gold/30 active:cursor-grabbing ${
          isDragging ? 'opacity-80' : ''
        }`}
      >
        <img src={championIconUrl(champion.image)} alt={champion.name} className="size-full object-cover" />
      </div>
      <div className="text-center">
        <p className="text-xl font-bold text-gold">{champion.name}</p>
        <p className="text-sm text-gold-light/70 capitalize">{champion.title}</p>
        <p className="mt-1 text-xs text-gold-light/60">
          {champion.classes.join(' · ')} · {champion.damageType}
        </p>
        <p className="text-xs text-gold-light/60">
          Usually plays: {champion.positions.map((role) => ROLE_LABELS[role]).join(', ')}
        </p>
      </div>
    </motion.div>
  )
}
