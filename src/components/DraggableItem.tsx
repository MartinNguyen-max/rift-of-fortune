import { useDraggable } from '@dnd-kit/core'
import { itemIconUrl } from '../data'
import type { Item } from '../data/types'
import { itemDragId } from './dragIds'
import { formatStats } from './formatStats'

interface DraggableItemProps {
  item: Item
  /** 'medium' is the bigger map size used during item rerolls. */
  size: 'small' | 'medium' | 'large'
  selected?: boolean
  /** Locked items can't be dragged or clicked (unless they can be rerolled, which only needs a tap). */
  locked?: boolean
  onClick?: () => void
  /** Tapping rerolls it: glows and shows a reroll badge. */
  rerollable?: boolean
}

export function DraggableItem({ item, size, selected = false, locked = false, onClick, rerollable = false }: DraggableItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: itemDragId(item.id),
    disabled: locked || rerollable,
  })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  const tooltip = [item.name, ...formatStats(item.stats)].join('\n')

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      style={style}
      onClick={locked && !rerollable ? undefined : onClick}
      aria-disabled={locked && !rerollable}
      title={tooltip}
      aria-label={rerollable ? `Reroll ${item.name}` : item.name}
      aria-pressed={selected}
      className={`relative shrink-0 touch-none overflow-hidden rounded border-2 transition ${
        rerollable ? 'cursor-pointer' : locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
      } ${
        size === 'large' ? 'size-12' : size === 'medium' ? 'size-9 sm:size-11' : 'size-7 sm:size-9'
      } ${selected ? 'scale-110 border-hextech shadow-lg shadow-hextech/50' : rerollable ? 'animate-reroll-glow border-gold-light hover:scale-110' : 'border-gold/60'} ${
        isDragging ? 'z-50 opacity-80' : ''
      }`}
    >
      <img src={itemIconUrl(item.image)} alt="" className="size-full object-cover" draggable={false} />
      {rerollable && (
        <span
          aria-hidden="true"
          className="absolute right-0 bottom-0 flex size-3.5 items-center justify-center rounded-tl bg-abyss/85 text-[9px] leading-none text-gold sm:size-4 sm:text-[11px]"
        >
          ↻
        </span>
      )}
    </button>
  )
}
