import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { MotionConfig } from 'framer-motion'
import { useCallback, useReducer, useState } from 'react'
import { ITEM_POOL_ID, itemIdFromDragId, ROLLED_CHAMPION_ID } from './components/dragIds'
import { DraftPanel } from './components/DraftPanel'
import { Footer } from './components/Footer'
import { PhaseSteps } from './components/PhaseSteps'
import { ItemPanel } from './components/ItemPanel'
import { ItemRoll } from './components/ItemRoll'
import { ResultsPanel } from './components/ResultsPanel'
import { RiftMap } from './components/RiftMap'
import { RoleSlot } from './components/RoleSlot'
import { gameData, itemIconUrl } from './data'
import type { Role } from './data/types'
import { rollChampion } from './game/draft'
import {
  canFinish,
  canPlace,
  canRoll,
  canStartItems,
  gameReducer,
  getTeamMembers,
  initialGameState,
} from './game/gameState'
import { canAssignItem, drawItems, itemsForRole, ITEMS_PER_CHAMPION, unassignedItems } from './game/items'
import { isRole } from './game/roles'
import { rateTeam } from './game/scoring/rateTeam'
import { emptyRoles } from './game/team'

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, initialGameState)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [itemsRolled, setItemsRolled] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const reveal = useCallback(() => dispatch({ type: 'reveal' }), [])
  const finishItemRoll = useCallback(() => setItemsRolled(true), [])
  const roll = () => dispatch({ type: 'roll', champion: rollChampion(gameData.champions, state.team) })
  const place = (role: Role) => dispatch({ type: 'place', role })
  const startItems = () => {
    const items = drawItems(gameData.items)
    for (const item of items) new Image().src = itemIconUrl(item.image)
    setItemsRolled(false)
    dispatch({ type: 'startItems', items })
  }
  const assignItem = (itemId: string, role: Role) => {
    dispatch({ type: 'assignItem', itemId, role })
    setSelectedItemId(null)
  }
  const unassignItem = (itemId: string) => dispatch({ type: 'unassignItem', itemId })
  const playAgain = () => {
    dispatch({ type: 'reset' })
    setSelectedItemId(null)
    setItemsRolled(false)
  }
  const toggleSelected = (itemId: string) => setSelectedItemId((current) => (current === itemId ? null : itemId))

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return
    if (active.id === ROLLED_CHAMPION_ID && isRole(over.id)) return place(over.id)

    const itemId = itemIdFromDragId(active.id)
    if (itemId === null) return
    if (isRole(over.id)) assignItem(itemId, over.id)
    else if (over.id === ITEM_POOL_ID) unassignItem(itemId)
  }

  /** Items can be assigned only once the item roll has finished. */
  const isItemPhase = state.phase === 'items' && itemsRolled
  const rating = state.phase === 'results' ? rateTeam(getTeamMembers(state)) : null
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
        score={rating?.champions.find((championRating) => championRating.role === role)?.score}
      />
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex min-h-screen flex-col">
          <header className="px-4 pt-6 pb-4 text-center sm:pt-8 sm:pb-6">
            <h1 className="font-display text-3xl font-black tracking-wide text-gold drop-shadow-[0_0_12px_rgb(200_170_110/0.35)] sm:text-5xl">
              LoL Rift Roulette
            </h1>
            <p className="mt-1 text-sm text-gold-light/60">Random champions. Random items. Honest feedback.</p>
          </header>
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-6 px-4 pb-8 sm:gap-8 lg:flex-row lg:items-start lg:justify-center">
            <RiftMap renderSlot={renderSlot} />
            <div className="w-full max-w-md rounded-xl border border-gold/30 bg-panel/70 p-5 shadow-2xl shadow-black/50 backdrop-blur sm:p-6">
              <PhaseSteps current={state.phase} />
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
              {state.phase === 'items' && !itemsRolled && (
                <ItemRoll items={state.items} onDone={finishItemRoll} />
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
              {rating && <ResultsPanel rating={rating} onPlayAgain={playAgain} />}
            </div>
          </main>
          <Footer />
        </div>
      </DndContext>
    </MotionConfig>
  )
}
