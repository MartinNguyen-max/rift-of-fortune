import { useDraggable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { championIconUrl } from '../data'
import type { Champion } from '../data/types'
import { ROLE_LABELS } from '../game/roles'
import { offerDragId } from './dragIds'

interface OfferPanelProps {
  /** The champions still to place. */
  champions: Champion[]
  selectedId: string | null
  onSelect: (championId: string) => void
}

/** Fast pace: all champions at once. Tap one, then a glowing role (or drag it there). */
export function OfferPanel({ champions, selectedId, onSelect }: OfferPanelProps) {
  return (
    <section className="flex flex-col items-center gap-3 text-center">
      <h2 className="text-sm font-semibold tracking-widest text-gold/80 uppercase">Place your {champions.length === 1 ? 'last champion' : `${champions.length} champions`}</h2>
      <div className="grid w-full grid-cols-5 gap-1.5 sm:gap-2">
        {champions.map((champion, index) => (
          <OfferCard
            key={champion.id}
            champion={champion}
            selected={champion.id === selectedId}
            delay={index * 0.06}
            onSelect={() => onSelect(champion.id)}
          />
        ))}
      </div>
      <p className="text-sm text-gold-light/70">
        <span className="lg:hidden">Tap a champion, then a glowing role.</span>
        <span className="hidden lg:inline">Drag a champion onto a role, or pick one and click a glowing role.</span>
      </p>
    </section>
  )
}

function OfferCard({ champion, selected, delay, onSelect }: { champion: Champion; selected: boolean; delay: number; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: offerDragId(champion.id) })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  return (
    <motion.button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay }}
      aria-pressed={selected}
      aria-label={`${champion.name}, usually ${champion.positions.map((role) => ROLE_LABELS[role]).join(', ')}`}
      className={`flex min-w-0 touch-none flex-col items-center gap-1 rounded-lg border-2 bg-abyss/60 p-1 transition ${
        selected ? 'scale-105 border-hextech shadow-lg shadow-hextech/40' : 'border-gold/40 hover:border-gold'
      } ${isDragging ? 'z-50 opacity-80' : ''}`}
    >
      <img src={championIconUrl(champion.image)} alt="" className="aspect-square w-full rounded-md" draggable={false} />
      <span className="w-full text-[10px] leading-tight font-semibold text-gold-light [overflow-wrap:anywhere] sm:text-xs">{champion.name}</span>
      <span className="text-[9px] leading-tight text-gold-light/60 sm:text-[10px]">
        {champion.positions.map((role) => ROLE_LABELS[role]).join(' · ')}
      </span>
    </motion.button>
  )
}
