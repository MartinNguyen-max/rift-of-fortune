import { useDraggable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { championIconUrl, championSplashUrl } from '../data'
import type { Champion } from '../data/types'
import { ROLE_LABELS } from '../game/roles'
import { ROLLED_CHAMPION_ID } from './dragIds'

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
      className="relative isolate flex w-full flex-row items-center gap-3 rounded-lg border border-gold/20 p-3 lg:flex-col lg:px-4 lg:pt-6 lg:pb-4"
    >
      {/* Clipped background layer; the card itself must not clip, or the dragged icon gets cut off. */}
      <div className="absolute inset-0 -z-10 overflow-hidden rounded-lg">
        <img src={championSplashUrl(champion.id)} alt="" className="size-full object-cover object-top opacity-35" />
        <div className="absolute inset-0 bg-linear-to-t from-panel via-panel/70 to-transparent" />
      </div>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        aria-label={`Drag ${champion.name} onto a role`}
        className={`relative z-10 size-16 shrink-0 cursor-grab lg:size-28 touch-none overflow-hidden rounded-xl border-2 border-gold shadow-lg shadow-gold/30 active:cursor-grabbing ${
          isDragging ? 'opacity-80' : ''
        }`}
      >
        <img src={championIconUrl(champion.image)} alt={champion.name} className="size-full object-cover" />
      </div>
      <div className="min-w-0 text-left lg:text-center">
        <p className="font-display text-xl font-bold text-gold lg:text-2xl">{champion.name}</p>
        <p className="text-sm text-gold-light/70 capitalize">{champion.title}</p>
        <p className="text-xs text-gold-light/60 lg:mt-1">
          {champion.classes.join(' · ')} · {champion.damageType}
        </p>
        <p className="text-xs text-gold-light/60">
          Usually plays: {champion.positions.map((role) => ROLE_LABELS[role]).join(', ')}
        </p>
      </div>
    </motion.div>
  )
}
