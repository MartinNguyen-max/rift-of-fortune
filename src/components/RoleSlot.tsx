import { useDroppable } from '@dnd-kit/core'
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
  score,
}: RoleSlotProps) {
  const { setNodeRef, isOver } = useDroppable({ id: role, disabled: !droppable })
  const label = ROLE_LABELS[role]

  return (
    <div ref={setNodeRef} className="relative flex flex-col items-center gap-1">
      {score !== undefined && (
        <span
          className={`absolute -top-2 -right-3 z-10 rounded-full border border-gold bg-abyss px-1.5 text-sm font-black ${scoreColor(score)}`}
        >
          {score}
        </span>
      )}
      <button
        type="button"
        onClick={onActivate}
        disabled={!onActivate}
        aria-label={champion ? `${label}: ${champion.name}` : `Place in ${label}`}
        className={`flex size-14 items-center justify-center overflow-hidden rounded-full border-2 bg-panel/80 transition disabled:cursor-default sm:size-16 ${
          champion ? 'border-gold' : 'border-dashed border-gold/50'
        } ${highlighted ? 'animate-pulse border-hextech hover:scale-110' : ''} ${
          isOver ? 'scale-125 border-solid border-hextech bg-hextech/30' : ''
        }`}
      >
        {champion ? (
          <img src={championIconUrl(champion.image)} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-xl text-gold/50">+</span>
        )}
      </button>

      <span className="rounded bg-abyss/80 px-1.5 text-xs font-semibold tracking-wide whitespace-nowrap text-gold uppercase">
        {champion ? `${label} · ${champion.name}` : label}
      </span>

      {items && (
        <div className="flex gap-1">
          {Array.from({ length: ITEMS_PER_CHAMPION }, (_, index) => {
            const item = items[index]
            return item ? (
              <DraggableItem key={item.id} item={item} size="small" onClick={() => onItemClick?.(item.id)} />
            ) : (
              <div key={index} className="size-6 rounded border border-dashed border-gold/40 bg-abyss/60 sm:size-7" />
            )
          })}
        </div>
      )}
    </div>
  )
}
