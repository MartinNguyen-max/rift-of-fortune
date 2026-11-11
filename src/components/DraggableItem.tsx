import { useDraggable } from '@dnd-kit/core'
import { itemIconUrl } from '../data'
import type { Item } from '../data/types'
import { itemDragId } from './dragIds'
import { formatStats } from './formatStats'

interface DraggableItemProps {
  item: Item
  size: 'small' | 'large'
  selected?: boolean
  onClick?: () => void
}

export function DraggableItem({ item, size, selected = false, onClick }: DraggableItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: itemDragId(item.id) })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  const tooltip = [item.name, ...formatStats(item.stats)].join('\n')

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      style={style}
      onClick={onClick}
      title={tooltip}
      aria-label={item.name}
      aria-pressed={selected}
      className={`relative shrink-0 cursor-grab touch-none overflow-hidden rounded border-2 transition active:cursor-grabbing ${
        size === 'large' ? 'size-12' : 'size-5 sm:size-7'
      } ${selected ? 'scale-110 border-hextech shadow-lg shadow-hextech/50' : 'border-gold/60'} ${
        isDragging ? 'z-50 opacity-80' : ''
      }`}
    >
      <img src={itemIconUrl(item.image)} alt="" className="size-full object-cover" draggable={false} />
    </button>
  )
}
