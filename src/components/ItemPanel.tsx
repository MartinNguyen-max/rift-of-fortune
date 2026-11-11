import { useDroppable } from '@dnd-kit/core'
import type { Item } from '../data/types'
import { ITEM_ROUNDS, ITEMS_PER_CHAMPION, ITEMS_PER_ROUND } from '../game/items'
import { Button } from './Button'
import { ITEM_POOL_ID } from './dragIds'
import { DraggableItem } from './DraggableItem'
import { formatStats } from './formatStats'

interface ItemPanelProps {
  /** The current round's items that are not handed out yet. */
  items: Item[]
  round: number
  selectedItemId: string | null
  /** True once every item of this round is handed out. */
  roundComplete: boolean
  onSelect: (itemId: string) => void
  /** Rolls the next round, or rates the team after the last round. */
  onContinue: () => void
}

export function ItemPanel({ items, round, selectedItemId, roundComplete, onSelect, onContinue }: ItemPanelProps) {
  const { setNodeRef, isOver } = useDroppable({ id: ITEM_POOL_ID })
  const selectedItem = items.find((item) => item.id === selectedItemId)
  const isLastRound = round >= ITEM_ROUNDS

  return (
    <section className="flex flex-col items-center gap-3 text-center lg:gap-5">
      <h2 className="text-sm font-semibold tracking-widest text-gold/80 uppercase">
        Gear up · Round {round} of {ITEM_ROUNDS}
      </h2>
      <p className="text-xs text-gold-light/70 lg:hidden">
        Tap a champion to give them the selected item (max {ITEMS_PER_CHAMPION} each). Tap an equipped item to take it
        back.
      </p>
      <p className="hidden text-sm text-gold-light/70 lg:block">
        {isLastRound
          ? `Last ${ITEMS_PER_ROUND} items. Every champion ends with exactly ${ITEMS_PER_CHAMPION}.`
          : `Hand out these ${ITEMS_PER_ROUND} items, max ${ITEMS_PER_CHAMPION} per champion. They lock when you roll the next ${ITEMS_PER_ROUND}.`}{' '}
        Tap a champion to give them the selected item, or drag an item onto one. Tap an equipped item to take it back.
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
          <li className="col-span-full m-auto text-sm text-gold-light/50">{isLastRound ? 'All items equipped!' : 'Round done! Roll the next items.'}</li>
        )}
      </ul>

      <p className="min-h-9 text-sm lg:hidden">
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

      <Button onClick={onContinue} disabled={!roundComplete}>
        {isLastRound ? 'Rate my team' : `Roll next ${ITEMS_PER_ROUND} items`}
      </Button>
    </section>
  )
}
