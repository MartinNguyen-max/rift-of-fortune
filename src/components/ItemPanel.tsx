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
  const selectedItem = items.find((item) => item.id === selectedItemId)

  return (
    <section className="flex flex-col items-center gap-5 text-center">
      <h2 className="text-sm font-semibold tracking-widest text-gold/80 uppercase">Gear up</h2>
      <p className="text-sm text-gold-light/70">
        Give each champion exactly {ITEMS_PER_CHAMPION} items. Drag an item onto a champion, or tap an item and then
        a champion. Tap an equipped item to take it back.
      </p>

      {/* A compact icon grid on small screens, a list with stats on large ones. */}
      <ul
        ref={setNodeRef}
        className={`grid min-h-20 w-full grid-cols-5 gap-2 rounded-lg border border-dashed p-2 transition lg:grid-cols-1 ${
          isOver ? 'border-hextech bg-hextech/10' : 'border-gold/30'
        }`}
      >
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-center gap-3 text-left lg:justify-start">
            <DraggableItem
              item={item}
              size="large"
              selected={item.id === selectedItemId}
              onClick={() => onSelect(item.id)}
            />
            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-sm font-semibold text-gold-light">{item.name}</p>
              <p className="truncate text-xs text-gold-light/60">{formatStats(item.stats).join(' · ')}</p>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="col-span-full m-auto text-sm text-gold-light/50">All items equipped!</li>
        )}
      </ul>

      <p className="min-h-10 text-sm lg:hidden">
        {selectedItem ? (
          <>
            <span className="font-semibold text-gold-light">{selectedItem.name}</span>
            <br />
            <span className="text-xs text-gold-light/60">{formatStats(selectedItem.stats).join(' · ')}</span>
          </>
        ) : (
          <span className="text-gold-light/50">Tap an item to see its stats.</span>
        )}
      </p>

      <Button onClick={onFinish} disabled={!canFinish}>
        Rate my team
      </Button>
    </section>
  )
}
