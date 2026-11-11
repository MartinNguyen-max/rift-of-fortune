import { useDraggable } from '@dnd-kit/core'
import { itemIconUrl } from '../data'
import type { Item } from '../data/types'
import { itemDragId } from './dragIds'
import { formatStats } from './formatStats'

interface DraggableItemProps {
  item: Item
  size: 'small' | 'large'
  selected?: boolean
  /** Locked items can't be dragged or clicked. */
  locked?: boolean
  onClick?: () => void
}

export function DraggableItem({ item, size, selected = false, locked = false, onClick }: DraggableItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: itemDragId(item.id),
    disabled: locked,
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
      onClick={locked ? undefined : onClick}
      aria-disabled={locked}
      title={tooltip}
      aria-label={item.name}
      aria-pressed={selected}
      className={`relative shrink-0 touch-none overflow-hidden rounded border-2 transition ${
        locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
      } ${
        size === 'large' ? 'size-12' : 'size-5 sm:size-7'
      } ${selected ? 'scale-110 border-hextech shadow-lg shadow-hextech/50' : 'border-gold/60'} ${
        isDragging ? 'z-50 opacity-80' : ''
      }`}
    >
      <img src={itemIconUrl(item.image)} alt="" className="size-full object-cover" draggable={false} />
    </button>
  )
}
