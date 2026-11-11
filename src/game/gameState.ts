import type { Champion, Item, Role } from '../data/types'
import { allItemsAssigned, canAssignItem, ITEM_ROUNDS, itemsForRole, itemsInRound, type ItemAssignments } from './items'
import { ROLES } from './roles'
import type { TeamMember } from './scoring/teamBalance'
import { emptyTeam, isTeamComplete, type Team } from './team'

export type Phase = 'draft' | 'items' | 'results'

export interface RolledChampion {
  champion: Champion
  /** False while the roll animation is still spinning. */
  revealed: boolean
}

export interface GameState {
  phase: Phase
  team: Team
  rolled: RolledChampion | null
  /** All items for the game, drawn up front and handed out round by round. */
  items: Item[]
  assignments: ItemAssignments
  /** Current item round (1-based), or 0 before the item phase. */
  itemRound: number
  /** False while the current round's items are still rolling in. */
  itemsRevealed: boolean
}

export type GameAction =
  | { type: 'roll'; champion: Champion }
  | { type: 'reveal' }
  | { type: 'place'; role: Role }
  | { type: 'startItems'; items: Item[] }
  | { type: 'revealItems' }
  | { type: 'nextItemRound' }
  | { type: 'assignItem'; itemId: string; role: Role }
  | { type: 'unassignItem'; itemId: string }
  | { type: 'finish' }
  | { type: 'reset' }

export function initialGameState(): GameState {
  return {
    phase: 'draft',
    team: emptyTeam(),
    rolled: null,
    items: [],
    assignments: {},
    itemRound: 0,
    itemsRevealed: false,
  }
}

export function canRoll(state: GameState): boolean {
  return state.phase === 'draft' && state.rolled === null && !isTeamComplete(state.team)
}

export function canPlace(state: GameState, role: Role): boolean {
  return state.phase === 'draft' && state.rolled?.revealed === true && state.team[role] === null
}

export function canStartItems(state: GameState): boolean {
  return state.phase === 'draft' && isTeamComplete(state.team)
}

/** The items rolled in the current round. */
export function currentRoundItems(state: GameState): Item[] {
  return itemsInRound(state.items, state.itemRound)
}

/** True while the player can hand out (or take back) items of the current round. */
export function canHandOutItems(state: GameState): boolean {
  return state.phase === 'items' && state.itemsRevealed
}

/** Items from earlier rounds are locked; only the current round's items can move. */
export function isItemMovable(state: GameState, itemId: string): boolean {
  return canHandOutItems(state) && currentRoundItems(state).some((item) => item.id === itemId)
}

function roundComplete(state: GameState): boolean {
  return canHandOutItems(state) && allItemsAssigned(currentRoundItems(state), state.assignments)
}

export function canStartNextItemRound(state: GameState): boolean {
  return state.itemRound < ITEM_ROUNDS && roundComplete(state)
}

export function canFinish(state: GameState): boolean {
  return state.itemRound === ITEM_ROUNDS && roundComplete(state)
}

/** The placed champions with their equipped items, in role order. */
export function getTeamMembers(state: GameState): TeamMember[] {
  return ROLES.flatMap((role) => {
    const champion = state.team[role]
    return champion ? [{ role, champion, items: itemsForRole(state.items, state.assignments, role) }] : []
  })
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'roll':
      return canRoll(state) ? { ...state, rolled: { champion: action.champion, revealed: false } } : state

    case 'reveal':
      return state.rolled ? { ...state, rolled: { ...state.rolled, revealed: true } } : state

    case 'place':
      if (!state.rolled || !canPlace(state, action.role)) return state
      return { ...state, team: { ...state.team, [action.role]: state.rolled.champion }, rolled: null }

    case 'startItems':
      if (!canStartItems(state)) return state
      return { ...state, phase: 'items', items: action.items, assignments: {}, itemRound: 1, itemsRevealed: false }

    case 'revealItems':
      return state.phase === 'items' ? { ...state, itemsRevealed: true } : state

    case 'nextItemRound':
      return canStartNextItemRound(state) ? { ...state, itemRound: state.itemRound + 1, itemsRevealed: false } : state

    case 'assignItem':
      if (!isItemMovable(state, action.itemId)) return state
      if (!canAssignItem(state.assignments, action.itemId, action.role)) return state
      return { ...state, assignments: { ...state.assignments, [action.itemId]: action.role } }

    case 'unassignItem': {
      if (!isItemMovable(state, action.itemId)) return state
      const assignments = Object.fromEntries(
        Object.entries(state.assignments).filter(([itemId]) => itemId !== action.itemId),
      )
      return { ...state, assignments }
    }

    case 'finish':
      return canFinish(state) ? { ...state, phase: 'results' } : state

    case 'reset':
      return initialGameState()
  }
}
