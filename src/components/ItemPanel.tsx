import { useDroppable } from '@dnd-kit/core'
import type { Item } from '../data/types'
import { ITEMS_PER_CHAMPION } from '../game/items'
import { Button } from './Button'
import { ITEM_POOL_ID } from './dragIds'
import { DraggableItem } from './DraggableItem'
import { formatStats } from './formatStats'

interface ItemPanelProps {
  items: Item[]
  selectedItemId: string | null
  canFinish: boolean
  onSelect: (itemId: string) => void
  onFinish: () => void
}

export function ItemPanel({ items, selectedItemId, canFinish, onSelect, onFinish }: ItemPanelProps) {
  const { setNodeRef, isOver } = useDroppable({ id: ITEM_POOL_ID })

  return (
    <section className="flex flex-col items-center gap-5 text-center">
      <h2 className="text-sm font-semibold tracking-widest text-gold/80 uppercase">Gear up</h2>
      <p className="text-sm text-gold-light/70">
        Give each champion exactly {ITEMS_PER_CHAMPION} items. Drag an item onto a champion, or click an item and
        then a champion. Click an equipped item to take it back.
      </p>

      <ul
        ref={setNodeRef}
        className={`flex min-h-20 w-full flex-col gap-2 rounded-lg border border-dashed p-2 transition ${
          isOver ? 'border-hextech bg-hextech/10' : 'border-gold/30'
        }`}
      >
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 text-left">
            <DraggableItem
              item={item}
              size="large"
              selected={item.id === selectedItemId}
              onClick={() => onSelect(item.id)}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gold-light">{item.name}</p>
              <p className="truncate text-xs text-gold-light/60">{formatStats(item.stats).join(' · ')}</p>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="m-auto text-sm text-gold-light/50">All items equipped!</li>}
      </ul>

      <Button onClick={onFinish} disabled={!canFinish}>
        Rate my team
      </Button>
    </section>
  )
}
