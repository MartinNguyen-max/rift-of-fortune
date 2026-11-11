import type { Champion, Item, Role } from '../data/types'
import { allItemsAssigned, canAssignItem, type ItemAssignments } from './items'
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
  items: Item[]
  assignments: ItemAssignments
}

export type GameAction =
  | { type: 'roll'; champion: Champion }
  | { type: 'reveal' }
  | { type: 'place'; role: Role }
  | { type: 'startItems'; items: Item[] }
  | { type: 'assignItem'; itemId: string; role: Role }
  | { type: 'unassignItem'; itemId: string }
  | { type: 'finish' }
  | { type: 'reset' }

export function initialGameState(): GameState {
  return { phase: 'draft', team: emptyTeam(), rolled: null, items: [], assignments: {} }
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

export function canFinish(state: GameState): boolean {
  return state.phase === 'items' && allItemsAssigned(state.items, state.assignments)
}

function hasItem(state: GameState, itemId: string): boolean {
  return state.items.some((item) => item.id === itemId)
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
      return canStartItems(state) ? { ...state, phase: 'items', items: action.items, assignments: {} } : state

    case 'assignItem':
      if (state.phase !== 'items' || !hasItem(state, action.itemId)) return state
      if (!canAssignItem(state.assignments, action.itemId, action.role)) return state
      return { ...state, assignments: { ...state.assignments, [action.itemId]: action.role } }

    case 'unassignItem': {
      if (state.phase !== 'items') return state
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
