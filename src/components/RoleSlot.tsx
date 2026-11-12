import { useDroppable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { championIconUrl } from '../data'
import type { Champion, Item, Role } from '../data/types'
import { ITEMS_PER_CHAMPION } from '../game/items'
import { ROLE_LABELS } from '../game/roles'
import { DraggableItem } from './DraggableItem'
import { scoreColor } from './scoreColor'

interface RoleSlotProps {
  role: Role
  champion: Champion | null
  /** Equipped items; `undefined` hides the item sockets (draft phase). */
  items?: Item[]
  /** Accepts drops when true. */
  droppable: boolean
  /** Glows to show that clicking it does something. */
  highlighted: boolean
  onActivate?: () => void
  onItemClick?: (itemId: string) => void
  /** Whether an equipped item can still be moved. Defaults to locked. */
  isItemMovable?: (itemId: string) => boolean
  /** Match vs Bots: the champion can be rerolled (shows a reroll badge), and is the one picked for it. */
  rerollable?: boolean
  selected?: boolean
  /** Champion score, shown as a badge once the team is rated. */
  score?: number
}

export function RoleSlot({
  role,
  champion,
  items,
  droppable,
  highlighted,
  onActivate,
  onItemClick,
  isItemMovable = () => false,
  score,
  rerollable = false,
  selected = false,
}: RoleSlotProps) {
  const { setNodeRef, isOver } = useDroppable({ id: role, disabled: !droppable })
  const label = ROLE_LABELS[role]

  return (
    <div ref={setNodeRef} className="flex flex-col items-center gap-0.5 sm:gap-1">
      <div className="relative">
        {score !== undefined && (
          <span
            className={`absolute -top-2 -right-3 z-10 rounded-full border border-gold bg-abyss px-1 text-xs font-black sm:px-1.5 sm:text-sm ${scoreColor(score)}`}
          >
            {score}
          </span>
        )}
        <button
          type="button"
          onClick={onActivate}
          disabled={!onActivate}
          aria-label={champion ? (rerollable ? `Reroll ${champion.name} (${label})` : `${label}: ${champion.name}`) : `Place in ${label}`}
          aria-pressed={rerollable ? selected : undefined}
          className={`flex size-11 items-center justify-center overflow-hidden rounded-full border-2 bg-panel/80 transition disabled:cursor-default sm:size-16 ${
            champion ? 'border-gold' : 'border-dashed border-gold/50'
          } ${highlighted ? 'animate-pulse border-hextech hover:scale-110' : ''} ${
            selected ? 'scale-110 border-gold-light shadow-[0_0_18px_rgb(200_170_110/0.8)]' : rerollable ? 'hover:scale-105' : ''
          } ${
            isOver ? 'scale-125 border-solid border-hextech bg-hextech/30' : ''
          }`}
        >
          {champion ? (
            <motion.img
              key={champion.id}
              src={championIconUrl(champion.image)}
              alt=""
              className="size-full object-cover"
              initial={{ rotateY: 90, scale: 0.7 }}
              animate={{ rotateY: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            />
          ) : (
            <span className="text-xl text-gold/50">+</span>
          )}
        </button>
        {rerollable && (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border border-gold bg-abyss text-xs text-gold sm:size-6 sm:text-sm ${
              selected ? 'animate-spin [animation-duration:2s]' : ''
            }`}
          >
            ↻
          </span>
        )}
      </div>

      <span className="rounded bg-abyss/80 px-1 text-[10px] font-semibold sm:px-1.5 sm:text-xs tracking-wide whitespace-nowrap text-gold uppercase">
        {champion ? (
          <>
            <span className="hidden sm:inline">{label} · </span>
            {champion.name}
          </>
        ) : (
          label
        )}
      </span>

      {items && (
        <div className="flex gap-1">
          {Array.from({ length: ITEMS_PER_CHAMPION }, (_, index) => {
            const item = items[index]
            return item ? (
              <DraggableItem
                key={item.id}
                item={item}
                size="small"
                locked={!isItemMovable(item.id)}
                onClick={() => onItemClick?.(item.id)}
              />
            ) : (
              <div key={index} className="size-5 rounded border border-dashed border-gold/40 bg-abyss/60 sm:size-7" />
            )
          })}
        </div>
      )}
    </div>
  )
}
