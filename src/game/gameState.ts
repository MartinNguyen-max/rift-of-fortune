import type { Champion, Item, Role } from '../data/types'
import {
  allItemsAssigned,
  canAssignItem,
  ITEM_COUNT,
  ITEM_ROUNDS,
  itemsForRole,
  itemsInRound,
  type ItemAssignments,
} from './items'
import { ROLES } from './roles'
import { CLASSIC_RULES, SHOP_ROLL_SIZE, SHOP_ROLLS, type GameRules } from './rules'
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
  /** Classic: all items, drawn up front and handed out round by round. Pick mode: every item rolled so far. */
  items: Item[]
  assignments: ItemAssignments
  /** Current item round (1-based), or 0 before the item phase. */
  itemRound: number
  /** False while the current round's items are still rolling in. */
  itemsRevealed: boolean
  /** Missing in games saved before rules existed; those played the Classic rules. */
  rules?: GameRules
  championRerollsLeft?: number
  /** Pick mode: the round each item was rolled in. */
  itemRounds?: Partial<Record<string, number>>
}

export type GameAction =
  | { type: 'roll'; champion: Champion }
  | { type: 'reveal' }
  | { type: 'place'; role: Role }
  | { type: 'rerollChampion'; role: Role; champion: Champion }
  | { type: 'startItems'; items: Item[] }
  | { type: 'revealItems' }
  | { type: 'nextItemRound'; items?: Item[] }
  | { type: 'assignItem'; itemId: string; role: Role }
  | { type: 'unassignItem'; itemId: string }
  | { type: 'finish' }
  | { type: 'reset' }

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
    itemRounds: {},
  }
}

export const rulesOf = (state: GameState): GameRules => state.rules ?? CLASSIC_RULES
const isPickMode = (state: GameState) => rulesOf(state).itemRolls === 'pick'

/** Item rounds in this game: two fixed rounds in Classic, three shop rolls in pick mode. */
export const itemRoundCount = (state: GameState): number => (isPickMode(state) ? SHOP_ROLLS : ITEM_ROUNDS)

export function canRoll(state: GameState): boolean {
  return state.phase === 'draft' && state.rolled === null && !isTeamComplete(state.team)
}

export function canPlace(state: GameState, role: Role): boolean {
  return state.phase === 'draft' && state.rolled?.revealed === true && state.team[role] === null
}

export function championRerollsLeft(state: GameState): number {
  return state.championRerollsLeft ?? 0
}

/** A placed champion can be swapped for a random new one while rerolls are left, during the draft. */
export function canRerollChampion(state: GameState, role: Role): boolean {
  return state.phase === 'draft' && state.team[role] !== null && championRerollsLeft(state) > 0
}

export function canStartItems(state: GameState): boolean {
  return state.phase === 'draft' && isTeamComplete(state.team)
}

/** The items rolled in the current round. */
export function currentRoundItems(state: GameState): Item[] {
  if (!isPickMode(state)) return itemsInRound(state.items, state.itemRound)
  return state.items.filter((item) => state.itemRounds?.[item.id] === state.itemRound)
}

/** True while the player can hand out (or take back) items of the current round. */
export function canHandOutItems(state: GameState): boolean {
  return state.phase === 'items' && state.itemsRevealed
}

/** Items from earlier rounds are locked; only the current round's items can move. */
export function isItemMovable(state: GameState, itemId: string): boolean {
  return canHandOutItems(state) && currentRoundItems(state).some((item) => item.id === itemId)
}

/** Item slots still empty across the team. */
export function openItemSlots(state: GameState): number {
  return ITEM_COUNT - Object.values(state.assignments).filter((role) => role !== undefined).length
}

function roundComplete(state: GameState): boolean {
  return canHandOutItems(state) && allItemsAssigned(currentRoundItems(state), state.assignments)
}

export function canStartNextItemRound(state: GameState): boolean {
  if (state.itemRound >= itemRoundCount(state)) return false
  if (isPickMode(state)) return canHandOutItems(state) && openItemSlots(state) > 0
  return roundComplete(state)
}

/** Pick mode: how many items the next shop roll brings; the final one fills exactly the empty slots. */
export function nextShopRollSize(state: GameState): number {
  return state.itemRound + 1 >= SHOP_ROLLS ? openItemSlots(state) : SHOP_ROLL_SIZE
}

export function canFinish(state: GameState): boolean {
  if (isPickMode(state)) return canHandOutItems(state) && openItemSlots(state) === 0
  return state.itemRound === ITEM_ROUNDS && roundComplete(state)
}

/** The placed champions with their equipped items, in role order. */
export function getTeamMembers(state: GameState): TeamMember[] {
  return ROLES.flatMap((role) => {
    const champion = state.team[role]
    return champion ? [{ role, champion, items: itemsForRole(state.items, state.assignments, role) }] : []
  })
}

const roundsFor = (items: Item[], round: number) => Object.fromEntries(items.map((item) => [item.id, round]))

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
      return {
        ...state,
        phase: 'items',
        items: action.items,
        assignments: {},
        itemRound: 1,
        itemsRevealed: false,
        itemRounds: isPickMode(state) ? roundsFor(action.items, 1) : {},
      }

    case 'revealItems':
      return state.phase === 'items' ? { ...state, itemsRevealed: true } : state

    case 'nextItemRound': {
      if (!canStartNextItemRound(state)) return state
      const round = state.itemRound + 1
      if (!isPickMode(state)) return { ...state, itemRound: round, itemsRevealed: false }
      const items = action.items ?? []
      if (items.length === 0) return state
      return {
        ...state,
        items: [...state.items, ...items],
        itemRounds: { ...state.itemRounds, ...roundsFor(items, round) },
        itemRound: round,
        itemsRevealed: false,
      }
    }

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
      return initialGameState(rulesOf(state))
  }
}
