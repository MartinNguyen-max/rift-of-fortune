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
  canRerollChampion,
  championRerollsLeft,
  itemRoundCount,
  nextShopRollSize,
  openItemSlots,
  rulesOf,
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
import { SHOP_ROLL_SIZE, type GameRules } from '../game/rules'
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
  /** Match vs Bots: rerolls and shop rolls. Classic rules when left out. */
  rules?: GameRules
  /** Shop rolls: `count` random items, none of them already rolled this game. */
  rollItems?: (count: number, excludeIds: ReadonlySet<string>) => Item[]
  /** A random champion to replace a placed one, not already on the team or waiting to be placed. */
  rerollChampion?: (state: GameState) => Champion
  onStateChange?: (state: GameState) => void
  /** Buttons and extras under the rank, e.g. Play again or Share. `reset` starts a new game. */
  resultActions: (rating: TeamRating, reset: () => void) => ReactNode
}

/** The map and side panel: draft, items and rating. Shared by every game mode. */
export function Game({
  title,
  initialState,
  nextChampion,
  drawItems,
  rules,
  rollItems,
  rerollChampion,
  onStateChange,
  resultActions,
}: GameProps) {
  const [state, dispatch] = useReducer(gameReducer, initialState ?? initialGameState(rules))
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  /** The placed champion the player tapped to reroll, waiting for confirmation. */
  const [rerollRole, setRerollRole] = useState<Role | null>(null)
  const isShop = rulesOf(state).itemRolls === 'pick' && rollItems !== undefined
  const seenItemIds = () => new Set(state.items.map(({ id }) => id))
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
  /** Places the champion, then rolls the next one so the player doesn't have to press Roll again. */
  const place = (role: Role) => {
    const placed = gameReducer(state, { type: 'place', role })
    dispatch({ type: 'place', role })
    if (canRoll(placed)) dispatch({ type: 'roll', champion: nextChampion(placed) })
  }
  const confirmReroll = () => {
    if (rerollRole && rerollChampion && canRerollChampion(state, rerollRole)) {
      dispatch({ type: 'rerollChampion', role: rerollRole, champion: rerollChampion(state) })
    }
    setRerollRole(null)
  }
  const startItems = () => {
    setRerollRole(null)
    const items = isShop ? rollItems(SHOP_ROLL_SIZE, new Set()) : drawItems()
    for (const item of items) new Image().src = itemIconUrl(item.image)
    dispatch({ type: 'startItems', items })
  }
  const assignItem = (itemId: string, role: Role) => {
    dispatch({ type: 'assignItem', itemId, role })
    setSelectedItemId(null)
  }
  const unassignItem = (itemId: string) => dispatch({ type: 'unassignItem', itemId })
  const reset = () => {
    setRerollRole(null)
    dispatch({ type: 'reset' })
    setSelectedItemId(null)
  }
  const continueItems = () => {
    setSelectedItemId(null)
    if (canFinish(state)) return dispatch({ type: 'finish' })
    if (!isShop) return dispatch({ type: 'nextItemRound' })
    const items = rollItems(nextShopRollSize(state), seenItemIds())
    for (const item of items) new Image().src = itemIconUrl(item.image)
    dispatch({ type: 'nextItemRound', items })
  }

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
  const poolItems = isItemPhase ? unassignedItems(currentRoundItems(state), state.assignments) : []
  /** One item is always selected, so players can just tap champions (no dragging needed on phones). */
  const activeItemId = poolItems.some((item) => item.id === selectedItemId) ? selectedItemId : (poolItems[0]?.id ?? null)
  const hasRoomForItem =(role: Role) => itemsForRole(state.items, state.assignments, role).length < ITEMS_PER_CHAMPION

  const renderSlot = (role: Role) => {
    if (state.phase === 'draft') {
      const placeable = canPlace(state, role)
      const rerollable = rerollChampion !== undefined && canRerollChampion(state, role)
      const toggleReroll = () => setRerollRole((current) => (current === role ? null : role))
      return (
        <RoleSlot
          role={role}
          champion={state.team[role]}
          droppable={placeable}
          highlighted={placeable}
          rerollable={rerollable}
          selected={rerollable && rerollRole === role}
          onActivate={placeable ? () => place(role) : rerollable ? toggleReroll : undefined}
        />
      )
    }

    const assignable = activeItemId !== null && canAssignItem(state.assignments, activeItemId, role)
    return (
      <RoleSlot
        role={role}
        champion={state.team[role]}
        items={itemsForRole(state.items, state.assignments, role)}
        droppable={isItemPhase && hasRoomForItem(role)}
        highlighted={isItemPhase && assignable}
        onActivate={isItemPhase && assignable ? () => assignItem(activeItemId, role) : undefined}
        onItemClick={isItemPhase ? unassignItem : undefined}
        isItemMovable={(itemId) => isItemMovable(state, itemId)}
        score={rating?.champions.find((championRating) => championRating.role === role)?.score}
      />
    )
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex w-full flex-col items-center gap-3 lg:gap-8 lg:flex-row lg:items-start lg:justify-center">
        <RiftMap renderSlot={renderSlot} compact={state.phase === 'items'} />
        <div className="w-full max-w-md rounded-xl border border-gold/30 bg-panel/70 p-3 shadow-2xl shadow-black/50 backdrop-blur sm:p-5 lg:p-6">
          <p className="mb-1 text-center font-display text-sm font-bold tracking-wider text-gold lg:mb-3">{title}</p>
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
              rerolls={
                rerollChampion && rulesOf(state).championRerolls > 0
                  ? {
                      left: championRerollsLeft(state),
                      total: rulesOf(state).championRerolls,
                      selectedName: rerollRole ? (state.team[rerollRole]?.name ?? null) : null,
                      hasChampions: emptyRoles(state.team).length < 5,
                      onConfirm: confirmReroll,
                      onCancel: () => setRerollRole(null),
                    }
                  : undefined
              }
            />
          )}
          {state.phase === 'items' && !state.itemsRevealed && (
            <ItemRoll
              key={state.itemRound}
              items={currentRoundItems(state)}
              round={state.itemRound}
              totalRounds={itemRoundCount(state)}
              onDone={revealItems}
            />
          )}
          {isItemPhase && (
            <ItemPanel
              items={poolItems}
              round={state.itemRound}
              selectedItemId={activeItemId}
              roundComplete={canStartNextItemRound(state) || canFinish(state)}
              onSelect={setSelectedItemId}
              onContinue={continueItems}
              shop={
                isShop
                  ? {
                      openSlots: openItemSlots(state),
                      nextRollSize: nextShopRollSize(state),
                      nextIsFinal: state.itemRound + 1 === itemRoundCount(state),
                      canRollAgain: canStartNextItemRound(state),
                      canFinish: canFinish(state),
                    }
                  : undefined
              }
            />
          )}
          {rating && <ResultsPanel rating={rating} actions={resultActions(rating, reset)} />}
        </div>
      </div>
    </DndContext>
  )
}
