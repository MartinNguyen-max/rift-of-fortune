import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useCallback, useReducer, useState } from 'react'
import { ITEM_POOL_ID, itemIdFromDragId, ROLLED_CHAMPION_ID } from './components/dragIds'
import { DraftPanel } from './components/DraftPanel'
import { ItemPanel } from './components/ItemPanel'
import { RiftMap } from './components/RiftMap'
import { RoleSlot } from './components/RoleSlot'
import { gameData } from './data'
import type { Role } from './data/types'
import { rollChampion } from './game/draft'
import { canFinish, canPlace, canRoll, canStartItems, gameReducer, initialGameState } from './game/gameState'
import { canAssignItem, drawItems, itemsForRole, ITEMS_PER_CHAMPION, unassignedItems } from './game/items'
import { isRole } from './game/roles'
import { emptyRoles } from './game/team'

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, initialGameState)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const reveal = useCallback(() => dispatch({ type: 'reveal' }), [])
  const roll = () => dispatch({ type: 'roll', champion: rollChampion(gameData.champions, state.team) })
  const place = (role: Role) => dispatch({ type: 'place', role })
  const startItems = () => dispatch({ type: 'startItems', items: drawItems(gameData.items) })
  const assignItem = (itemId: string, role: Role) => {
    dispatch({ type: 'assignItem', itemId, role })
    setSelectedItemId(null)
  }
  const unassignItem = (itemId: string) => dispatch({ type: 'unassignItem', itemId })
  const toggleSelected = (itemId: string) => setSelectedItemId((current) => (current === itemId ? null : itemId))

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return
    if (active.id === ROLLED_CHAMPION_ID && isRole(over.id)) return place(over.id)

    const itemId = itemIdFromDragId(active.id)
    if (itemId === null) return
    if (isRole(over.id)) assignItem(itemId, over.id)
    else if (over.id === ITEM_POOL_ID) unassignItem(itemId)
  }

  const isItemPhase = state.phase === 'items'
  const hasRoomForItem = (role: Role) => itemsForRole(state.items, state.assignments, role).length < ITEMS_PER_CHAMPION

  const renderSlot = (role: Role) => {
    if (state.phase === 'draft') {
      const placeable = canPlace(state, role)
      return (
        <RoleSlot
          role={role}
          champion={state.team[role]}
          droppable={placeable}
          highlighted={placeable}
          onActivate={placeable ? () => place(role) : undefined}
        />
      )
    }

    const assignable = selectedItemId !== null && canAssignItem(state.assignments, selectedItemId, role)
    return (
      <RoleSlot
        role={role}
        champion={state.team[role]}
        items={itemsForRole(state.items, state.assignments, role)}
        droppable={isItemPhase && hasRoomForItem(role)}
        highlighted={isItemPhase && assignable}
        onActivate={isItemPhase && assignable ? () => assignItem(selectedItemId, role) : undefined}
        onItemClick={isItemPhase ? unassignItem : undefined}
      />
    )
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex min-h-screen flex-col">
        <header className="px-4 py-6 text-center">
          <h1 className="text-3xl font-bold tracking-wide text-gold sm:text-4xl">LoL Rift Roulette</h1>
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-8 px-4 pb-8 lg:flex-row lg:items-start lg:justify-center">
          <RiftMap renderSlot={renderSlot} />
          <div className="w-full max-w-sm rounded-xl border border-gold/30 bg-panel/60 p-6">
            {state.phase === 'draft' && (
              <DraftPanel
                rolled={state.rolled}
                pickNumber={6 - emptyRoles(state.team).length}
                canRoll={canRoll(state)}
                teamComplete={canStartItems(state)}
                onRoll={roll}
                onRevealed={reveal}
                onStartItems={startItems}
              />
            )}
            {isItemPhase && (
              <ItemPanel
                items={unassignedItems(state.items, state.assignments)}
                selectedItemId={selectedItemId}
                canFinish={canFinish(state)}
                onSelect={toggleSelected}
                onFinish={() => dispatch({ type: 'finish' })}
              />
            )}
          </div>
        </main>
      </div>
    </DndContext>
  )
}
