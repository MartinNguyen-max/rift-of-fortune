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
  canRerollChampion,
  canRerollItem,
  canRoll,
  canStartItems,
  canStartNextItemRound,
  championRerollsLeft,
  currentRoundItems,
  gameReducer,
  getTeamMembers,
  initialGameState,
  isItemMovable,
  itemRerollsLeft,
  rulesOf,
  type GameState,
} from '../game/gameState'
import { canAssignItem, itemsForRole, ITEMS_PER_CHAMPION, unassignedItems } from '../game/items'
import { isRole } from '../game/roles'
import type { GameRules } from '../game/rules'
import { rateTeam, type TeamRating } from '../game/scoring/rateTeam'
import { playSound, playSynth, preloadSounds, prepareChampionVoice } from '../services/sound'
import { emptyRoles } from '../game/team'
import { ITEM_POOL_ID, itemIdFromDragId, ROLLED_CHAMPION_ID } from './dragIds'
import { DraftPanel } from './DraftPanel'
import { ItemPanel } from './ItemPanel'
import { ItemRoll } from './ItemRoll'
import { PhaseSteps } from './PhaseSteps'
import type { RerollBoxProps } from './RerollBox'
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
  /** Match vs Bots: champion and item rerolls. Classic rules when left out. */
  rules?: GameRules
  /** A random champion to replace a placed one, not already on the team. */
  rerollChampion?: (state: GameState) => Champion
  /** A random item to replace an equipped one, not already in the game. */
  rerollItem?: (state: GameState) => Item
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
  rerollChampion,
  rerollItem,
  onStateChange,
  resultActions,
}: GameProps) {
  const [state, dispatch] = useReducer(gameReducer, initialState ?? initialGameState(rules))
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  /** What is playing the short reroll spin right now. */
  const [spinningRole, setSpinningRole] = useState<Role | null>(null)
  const [spinningItemId, setSpinningItemId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  useEffect(() => {
    onStateChange?.(state)
  }, [state, onStateChange])

  useEffect(() => preloadSounds(), [])

  const reveal = useCallback(() => dispatch({ type: 'reveal' }), [])
  const revealItems = useCallback(() => dispatch({ type: 'revealItems' }), [])
  const stopChampionSpin = useCallback(() => setSpinningRole(null), [])
  const stopItemSpin = useCallback(() => setSpinningItemId(null), [])
  const roll = () => dispatch({ type: 'roll', champion: nextChampion(state) })
  /** Places the champion, then rolls the next one so the player doesn't have to press Roll again. */
  const place = (role: Role) => {
    const placed = gameReducer(state, { type: 'place', role })
    dispatch({ type: 'place', role })
    playSound('lock-in')
    if (canRoll(placed)) dispatch({ type: 'roll', champion: nextChampion(placed) })
  }
  /** One tap rerolls: no confirm step, so it stays fast. */
  const rerollChampionIn = (role: Role) => {
    if (!rerollChampion || !canRerollChampion(state, role) || spinningRole) return
    const champion = rerollChampion(state)
    dispatch({ type: 'rerollChampion', role, champion })
    prepareChampionVoice(champion.id)()
    playSound('reroll')
    setSpinningRole(role)
  }
  const rerollEquippedItem = (itemId: string) => {
    if (!rerollItem || !canRerollItem(state, itemId) || spinningItemId) return
    const item = rerollItem(state)
    new Image().src = itemIconUrl(item.image)
    dispatch({ type: 'rerollItem', itemId, item })
    playSound('reroll')
    setSpinningItemId(item.id)
  }
  const startItems = () => {
    const items = drawItems()
    for (const item of items) new Image().src = itemIconUrl(item.image)
    playSynth('roll')
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
    if (!canFinish(state)) playSynth('roll')
    dispatch({ type: canFinish(state) ? 'finish' : 'nextItemRound' })
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
  const hasRoomForItem = (role: Role) => itemsForRole(state.items, state.assignments, role).length < ITEMS_PER_CHAMPION
  const { championRerolls, itemRerolls } = rulesOf(state)
  /** Once every item is equipped, tapping one picks it for a reroll instead of taking it back. */
  const itemRerollsOpen = rerollItem !== undefined && itemRerolls > 0 && canFinish(state)
  const canPickItemReroll = itemRerollsOpen && itemRerollsLeft(state) > 0

  const championRerollBox: RerollBoxProps | undefined =
    rerollChampion && championRerolls > 0
      ? {
          label: 'Champion rerolls',
          left: championRerollsLeft(state),
          total: championRerolls,
          hint: 'Tap any champion on the map to reroll them.',
        }
      : undefined

  const itemRerollBox: RerollBoxProps | undefined = itemRerollsOpen
    ? {
        label: 'Item rerolls',
        left: itemRerollsLeft(state),
        total: itemRerolls,
        hint: 'Tap any item on the map to reroll it.',
      }
    : undefined

  const renderSlot = (role: Role) => {
    if (state.phase === 'draft') {
      const placeable = canPlace(state, role)
      const rerollable = rerollChampion !== undefined && canRerollChampion(state, role)
      return (
        <RoleSlot
          role={role}
          champion={state.team[role]}
          droppable={placeable}
          highlighted={placeable}
          rerollable={rerollable}

          spinning={spinningRole === role}
          onSpinDone={stopChampionSpin}
          onActivate={placeable ? () => place(role) : rerollable ? () => rerollChampionIn(role) : undefined}
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
        onItemClick={canPickItemReroll ? rerollEquippedItem : isItemPhase ? unassignItem : undefined}
        isItemMovable={(itemId) => isItemMovable(state, itemId)}
        spinningItemId={spinningItemId}
        onItemSpinDone={stopItemSpin}
        itemsRerollable={canPickItemReroll}
        largeItems={itemRerollsOpen}
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
              rerolls={championRerollBox}
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
              items={poolItems}
              round={state.itemRound}
              selectedItemId={activeItemId}
              roundComplete={canStartNextItemRound(state) || canFinish(state)}
              onSelect={setSelectedItemId}
              onContinue={continueItems}
              rerolls={itemRerollBox}
            />
          )}
          {rating && <ResultsPanel rating={rating} actions={resultActions(rating, reset)} />}
        </div>
      </div>
    </DndContext>
  )
}
