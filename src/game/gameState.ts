import type { Champion, Role } from '../data/types'
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
}

export type GameAction =
  | { type: 'roll'; champion: Champion }
  | { type: 'reveal' }
  | { type: 'place'; role: Role }
  | { type: 'reset' }

export function initialGameState(): GameState {
  return { phase: 'draft', team: emptyTeam(), rolled: null }
}

export function canRoll(state: GameState): boolean {
  return state.phase === 'draft' && state.rolled === null && !isTeamComplete(state.team)
}

export function canPlace(state: GameState, role: Role): boolean {
  return state.phase === 'draft' && state.rolled?.revealed === true && state.team[role] === null
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'roll':
      return canRoll(state) ? { ...state, rolled: { champion: action.champion, revealed: false } } : state
    case 'reveal':
      return state.rolled ? { ...state, rolled: { ...state.rolled, revealed: true } } : state
    case 'place': {
      if (!state.rolled || !canPlace(state, action.role)) return state
      return { ...state, team: { ...state.team, [action.role]: state.rolled.champion }, rolled: null }
    }
    case 'reset':
      return initialGameState()
  }
}
