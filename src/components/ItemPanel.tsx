import { useDroppable } from '@dnd-kit/core'
import type { Item } from '../data/types'
import { ITEM_ROUNDS, ITEMS_PER_CHAMPION, ITEMS_PER_ROUND } from '../game/items'
import { SHOP_ROLLS } from '../game/rules'
import { Button } from './Button'
import { ITEM_POOL_ID } from './dragIds'
import { DraggableItem } from './DraggableItem'
import { formatStats } from './formatStats'

/** Match vs Bots: three shop rolls where the player keeps any items they like. */
export interface ShopRolls {
  /** Item slots still empty across the team. */
  openSlots: number
  /** How many items the next roll brings. */
  nextRollSize: number
  canRollAgain: boolean
  /** The next roll is the last one, which fills exactly the empty slots. */
  nextIsFinal: boolean
  canFinish: boolean
}

interface ItemPanelProps {
  /** The current round's items that are not handed out yet. */
  items: Item[]
  round: number
  selectedItemId: string | null
  /** Classic: true once every item of this round is handed out. */
  roundComplete: boolean
  onSelect: (itemId: string) => void
  /** Rolls the next round, or rates the team after the last round. */
  onContinue: () => void
  shop?: ShopRolls
}

export function ItemPanel({ items, round, selectedItemId, roundComplete, onSelect, onContinue, shop }: ItemPanelProps) {
  const { setNodeRef, isOver } = useDroppable({ id: ITEM_POOL_ID })
  const selectedItem = items.find((item) => item.id === selectedItemId)
  const totalRounds = shop ? SHOP_ROLLS : ITEM_ROUNDS
  const isLastRound = round >= totalRounds

  return (
    <section className="flex flex-col items-center gap-3 text-center lg:gap-5">
      <h2 className="text-sm font-semibold tracking-widest text-gold/80 uppercase">
        {shop ? 'Shop' : 'Gear up'} · Round {round} of {totalRounds}
      </h2>
      {shop && <ShopRollPips round={round} />}

      {shop ? (
        <p className="text-xs text-gold-light/70 lg:text-sm">
          {isLastRound
            ? `Final roll: these fill your last ${shop.openSlots === 1 ? 'slot' : `${shop.openSlots} slots`}. Every item must go.`
            : `Keep any items you like (${shop.openSlots} slots left). The rest are gone when you roll again.`}
        </p>
      ) : (
        <>
          {/* Phones show the hint only in the first round, to save space. */}
          {round === 1 && items.length > 0 && (
            <p className="text-xs text-gold-light/70 lg:hidden">
              Tap a champion to give them the selected item (max {ITEMS_PER_CHAMPION} each). Tap an equipped item to take it
              back.
            </p>
          )}
          <p className="hidden text-sm text-gold-light/70 lg:block">
            {isLastRound
              ? `Last ${ITEMS_PER_ROUND} items. Every champion ends with exactly ${ITEMS_PER_CHAMPION}.`
              : `Hand out these ${ITEMS_PER_ROUND} items, max ${ITEMS_PER_CHAMPION} per champion. They lock when you roll the next ${ITEMS_PER_ROUND}.`}{' '}
            Tap a champion to give them the selected item, or drag an item onto one. Tap an equipped item to take it back.
          </p>
        </>
      )}

      {/* A compact icon grid on small screens, a list with stats on large ones. */}
      <ul
        ref={setNodeRef}
        className={`grid min-h-14 w-full lg:min-h-20 grid-cols-5 gap-2 rounded-lg border border-dashed p-2 transition lg:grid-cols-1 ${
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
          <li className="col-span-full m-auto text-sm text-gold-light/50">
            {shop ? (shop.canFinish ? 'Every slot is filled!' : 'Nothing left here. Roll again!') : isLastRound ? 'All items equipped!' : 'Round done! Roll the next items.'}
          </li>
        )}
      </ul>

      {selectedItem && (
        <p className="w-full truncate text-xs lg:hidden">
          <span className="font-semibold text-gold-light">{selectedItem.name}</span>
          <span className="text-gold-light/60"> · {formatStats(selectedItem.stats).join(' · ')}</span>
        </p>
      )}

      {shop ? <ShopButton shop={shop} isLastRound={isLastRound} onContinue={onContinue} /> : (
        <Button onClick={onContinue} disabled={!roundComplete}>
          {isLastRound ? 'Rate my team' : `Roll next ${ITEMS_PER_ROUND} items`}
        </Button>
      )}
    </section>
  )
}

function ShopButton({ shop, isLastRound, onContinue }: { shop: ShopRolls; isLastRound: boolean; onContinue: () => void }) {
  if (shop.canFinish || isLastRound) {
    return (
      <Button onClick={onContinue} disabled={!shop.canFinish}>
        Rate my team
      </Button>
    )
  }

  return (
    <Button onClick={onContinue} disabled={!shop.canRollAgain}>
      {shop.nextIsFinal ? `Final roll · ${shop.nextRollSize} items` : 'Roll again ↻'}
    </Button>
  )
}

/** One pip per shop roll: used, current and still to come. */
function ShopRollPips({ round }: { round: number }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label={`Shop roll ${round} of ${SHOP_ROLLS}`}>
      {Array.from({ length: SHOP_ROLLS }, (_, index) => {
        const roll = index + 1
        const style =
          roll < round
            ? 'border-gold/30 text-gold/40'
            : roll === round
              ? 'border-hextech bg-hextech/20 text-hextech shadow-[0_0_8px_rgb(10_200_185/0.5)]'
              : 'border-gold bg-gold/15 text-gold'
        return (
          <li key={roll} aria-hidden="true" className={`flex size-6 items-center justify-center rounded-full border text-xs font-bold ${style}`}>
            {roll}
          </li>
        )
      })}
    </ol>
  )
}
