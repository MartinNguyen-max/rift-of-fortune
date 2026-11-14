import type { Champion, Item, Role } from '../data/types'
import { allItemsAssigned, canAssignItem, ITEM_COUNT, ITEM_ROUNDS, itemsForRole, itemsInRound, type ItemAssignments } from './items'
import { ROLES } from './roles'
import { CLASSIC_RULES, type GameRules } from './rules'
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
  /** Missing in games saved before rules existed; those played the Classic rules. */
  rules?: GameRules
  championRerollsLeft?: number
  itemRerollsLeft?: number
}

export type GameAction =
  | { type: 'roll'; champion: Champion }
  | { type: 'reveal' }
  | { type: 'place'; role: Role }
  | { type: 'rerollChampion'; role: Role; champion: Champion }
  | { type: 'startItems'; items: Item[] }
  | { type: 'revealItems' }
  | { type: 'nextItemRound' }
  | { type: 'assignItem'; itemId: string; role: Role }
  | { type: 'unassignItem'; itemId: string }
  | { type: 'rerollItem'; itemId: string; item: Item }
  | { type: 'finish' }
  | { type: 'reset' }

/** A new game. */
export function initialGameState(rules: GameRules = CLASSIC_RULES): GameState {
  return {
    phase: 'draft',
    team: emptyTeam(),
    rolled: null,
    items: [],
    assignments: {},
    itemRound: 0,
    itemsRevealed: false,
    rules,
    championRerollsLeft: rules.championRerolls,
    itemRerollsLeft: rules.itemRerolls,
  }
}

export const rulesOf = (state: GameState): GameRules => state.rules ?? CLASSIC_RULES
export const championRerollsLeft = (state: GameState): number => state.championRerollsLeft ?? 0
export const itemRerollsLeft = (state: GameState): number => state.itemRerollsLeft ?? 0

export function canRoll(state: GameState): boolean {
  return state.phase === 'draft' && state.rolled === null && !isTeamComplete(state.team)
}

export function canPlace(state: GameState, role: Role): boolean {
  return state.phase === 'draft' && state.rolled?.revealed === true && state.team[role] === null
}

export function canStartItems(state: GameState): boolean {
  return state.phase === 'draft' && isTeamComplete(state.team)
}

/** Champion rerolls open once the whole team is placed, before the items are rolled. */
export function canRerollChampion(state: GameState, role: Role): boolean {
  return canStartItems(state) && state.team[role] !== null && championRerollsLeft(state) > 0
}

/** The items rolled in the current round. */
export function currentRoundItems(state: GameState): Item[] {
  return itemsInRound(state.items, state.itemRound, ITEM_COUNT / ITEM_ROUNDS)
}

/** True while the player can hand out (or take back) items of the current round. */
export function canHandOutItems(state: GameState): boolean {
  return state.phase === 'items' && state.itemsRevealed
}

/**
 * Items from earlier rounds are locked; only the current round's items can move. With item
 * rerolls, every item locks once all ten are placed: from then on they can only be rerolled.
 */
export function isItemMovable(state: GameState, itemId: string): boolean {
  if (isRerollStage(state)) return false
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

/** The reroll step: all ten items are placed and the mode has item rerolls (even when they are used up). */
export function isRerollStage(state: GameState): boolean {
  return rulesOf(state).itemRerolls > 0 && canFinish(state)
}

/** Item rerolls open once all ten items are equipped, before the team is rated. */
export function canRerollItem(state: GameState, itemId: string): boolean {
  return canFinish(state) && itemRerollsLeft(state) > 0 && state.assignments[itemId] !== undefined
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

    case 'rerollChampion':
      if (!canRerollChampion(state, action.role)) return state
      return {
        ...state,
        team: { ...state.team, [action.role]: action.champion },
        championRerollsLeft: championRerollsLeft(state) - 1,
      }

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

    case 'rerollItem': {
      const role = state.assignments[action.itemId]
      if (!role || !canRerollItem(state, action.itemId)) return state
      if (state.items.some(({ id }) => id === action.item.id)) return state
      // The new item takes the old one's place, so it stays in the same round.
      const items = state.items.map((item) => (item.id === action.itemId ? action.item : item))
      const assignments = Object.fromEntries(
        Object.entries(state.assignments).filter(([itemId]) => itemId !== action.itemId),
      )
      return {
        ...state,
        items,
        assignments: { ...assignments, [action.item.id]: role },
        itemRerollsLeft: itemRerollsLeft(state) - 1,
      }
    }

    case 'finish':
      return canFinish(state) ? { ...state, phase: 'results' } : state

    case 'reset':
      return initialGameState(rulesOf(state))
  }
}
