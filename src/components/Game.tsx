import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useCallback, useEffect, useReducer, useState, type ReactNode } from 'react'
import { itemIconUrl } from '../data'
import type { Champion, Item, Role } from '../data/types'
import {
  canFinish,
  canHandOutItems,
  canPlace,
  canRoll,
  canStartItems,
  canStartNextItemRound,
  currentRoundItems,
  gameReducer,
  getTeamMembers,
  initialGameState,
  isItemMovable,
  type GameState,
} from '../game/gameState'
import { canAssignItem, itemsForRole, ITEMS_PER_CHAMPION, unassignedItems } from '../game/items'
import { isRole } from '../game/roles'
import { rateTeam, type TeamRating } from '../game/scoring/rateTeam'
import { emptyRoles } from '../game/team'
import { ITEM_POOL_ID, itemIdFromDragId, ROLLED_CHAMPION_ID } from './dragIds'
import { DraftPanel } from './DraftPanel'
import { ItemPanel } from './ItemPanel'
import { ItemRoll } from './ItemRoll'
import { PhaseSteps } from './PhaseSteps'
import { ResultsPanel } from './ResultsPanel'
import { RiftMap } from './RiftMap'
import { RoleSlot } from './RoleSlot'

interface GameProps {
  /** Shown above the phase steps, e.g. "Classic" or "Daily Rift #3". */
  title: string
  initialState?: GameState
  /** The next champion to roll (random in Classic, fixed in the Daily). */
  nextChampion: (state: GameState) => Champion
  /** The ten items for this game. */
  drawItems: () => Item[]
  onStateChange?: (state: GameState) => void
  /** Buttons and extras under the rank, e.g. Play again or Share. `reset` starts a new game. */
  resultActions: (rating: TeamRating, reset: () => void) => ReactNode
}

/** The map and side panel: draft, items and rating. Shared by every game mode. */
export function Game({ title, initialState, nextChampion, drawItems, onStateChange, resultActions }: GameProps) {
  const [state, dispatch] = useReducer(gameReducer, initialState ?? initialGameState())
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  useEffect(() => {
    onStateChange?.(state)
  }, [state, onStateChange])

  const reveal = useCallback(() => dispatch({ type: 'reveal' }), [])
  const revealItems = useCallback(() => dispatch({ type: 'revealItems' }), [])
  const roll = () => dispatch({ type: 'roll', champion: nextChampion(state) })
  const place = (role: Role) => dispatch({ type: 'place', role })
  const startItems = () => {
    const items = drawItems()
    for (const item of items) new Image().src = itemIconUrl(item.image)
    dispatch({ type: 'startItems', items })
  }
  const assignItem = (itemId: string, role: Role) => {
    dispatch({ type: 'assignItem', itemId, role })
    setSelectedItemId(null)
  }
  const unassignItem = (itemId: string) => dispatch({ type: 'unassignItem', itemId })
  const reset = () => {
    dispatch({ type: 'reset' })
    setSelectedItemId(null)
  }
  const continueItems = () => {
    setSelectedItemId(null)
    if (canFinish(state)) dispatch({ type: 'finish' })
    else dispatch({ type: 'nextItemRound' })
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

  /** Items can be handed out only once the round's roll has finished. */
  const isItemPhase = canHandOutItems(state)
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
        isItemMovable={(itemId) => isItemMovable(state, itemId)}
        score={rating?.champions.find((championRating) => championRating.role === role)?.score}
      />
    )
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex w-full flex-col items-center gap-6 sm:gap-8 lg:flex-row lg:items-start lg:justify-center">
        <RiftMap renderSlot={renderSlot} />
        <div className="w-full max-w-md rounded-xl border border-gold/30 bg-panel/70 p-5 shadow-2xl shadow-black/50 backdrop-blur sm:p-6">
          <p className="mb-3 text-center font-display text-sm font-bold tracking-wider text-gold">{title}</p>
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
          {state.phase === 'items' && !state.itemsRevealed && (
            <ItemRoll
              key={state.itemRound}
              items={currentRoundItems(state)}
              round={state.itemRound}
              onDone={revealItems}
            />
          )}
          {isItemPhase && (
            <ItemPanel
              items={unassignedItems(currentRoundItems(state), state.assignments)}
              round={state.itemRound}
              selectedItemId={selectedItemId}
              roundComplete={canStartNextItemRound(state) || canFinish(state)}
              onSelect={toggleSelected}
              onContinue={continueItems}
            />
          )}
          {rating && <ResultsPanel rating={rating} actions={resultActions(rating, reset)} />}
        </div>
      </div>
    </DndContext>
  )
}
