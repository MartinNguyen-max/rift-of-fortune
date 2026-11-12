import { seededRandom } from '../random'

/**
 * Every mini-game is played as two lists of moves, one per player: the same model for a game
 * against the bot and for Multiplayer. A move is a whole number (a time in ms, a lane, a score...).
 * `settle` decides the winner from the moves alone, so both players and the host agree.
 */

/** The two players. In solo games, 0 is you and 1 is the bot. In Multiplayer, 0 is the host (blue). */
export type Player = 0 | 1
export const other = (player: Player): Player => (player === 0 ? 1 : 0)

/** A player's moves by step; a hole means that step isn't played yet. */
export type Moves = readonly (number | undefined)[]
export type BothMoves = readonly [Moves, Moves]

/** Solo against a bot can take longer; Multiplayer versions are short. */
export type Variant = 'solo' | 'live'

export interface GameSetup {
  seed: number
  variant: Variant
  /** Multiplayer option: in role games (hide/guess, plant/walk) both players play both roles. */
  bothRoles: boolean
  /** Multiplayer: the event is late in the match (the smite game fights Elder instead of Baron). */
  late: boolean
}

export const soloSetup = (seed: number): GameSetup => ({ seed, variant: 'solo', bothRoles: true, late: false })

export interface Settled {
  /** Null for a tie. */
  winner: Player | null
  scores: [number, number]
}

export interface Owed {
  player: Player
  step: number
}

export interface MiniGameRules {
  /**
   * 1: both players do the same thing once (a fair duel). 2: a role game (one hides, one guesses);
   * with `bothRoles`, each player gets a turn in each role.
   */
  chances: 1 | 2
  /** The longest the game can take in Multiplayer, in seconds (the host's time limit). */
  liveSeconds: (setup: GameSetup) => number
  /** The moves the game is waiting for right now. Empty once it can be settled. */
  owed: (moves: BothMoves, setup: GameSetup) => Owed[]
  /** The winner and both scores once the game is decided, otherwise null. */
  settle: (moves: BothMoves, setup: GameSetup) => Settled | null
  /** The move for a player who never answered: always a poor one. */
  fallback: (owed: Owed, moves: BothMoves, setup: GameSetup) => number
  /** The bot's move (the bot is player 1), or undefined while it waits for the player. */
  botMove: (step: number, moves: BothMoves, setup: GameSetup) => number | undefined
  /** "245 ms", "850 gold", "2 rounds". */
  formatScore: (score: number, setup: GameSetup) => string
  /** The personal best from your moves in a finished solo game, if the game keeps one. */
  best?: { of: (moves: BothMoves, setup: GameSetup) => number | null; lowerIsBetter: boolean; format: (value: number) => string }
}

/** A step's move, or undefined. */
export const moveAt = (moves: Moves, step: number): number | undefined => moves[step]

/** How many steps in a row (from 0) a player has played. */
export function playedSteps(moves: Moves): number {
  let count = 0
  while (moves[count] !== undefined) count += 1
  return count
}

/** Adds a move. The first move for a step counts; later ones are ignored. */
export function withMove(moves: Moves, step: number, value: number): Moves {
  if (moves[step] !== undefined) return moves
  const next = [...moves]
  next[step] = value
  return next
}

/** The bot's moves for every step it can play now, given the player's moves. */
export function botMoves(rules: MiniGameRules, player: Moves, setup: GameSetup, maxSteps = 40): Moves {
  let bot: Moves = []
  for (let step = 0; step < maxSteps; step++) {
    const move = rules.botMove(step, [player, bot], setup)
    if (move === undefined) break
    bot = withMove(bot, step, move)
  }
  return bot
}

/**
 * In role games, who takes the first role (hider, planter, thrower). Solo: you. Multiplayer:
 * decided by the seed, so it is fair and the same for both.
 */
export function firstPlayer(setup: GameSetup): Player {
  if (setup.variant === 'solo') return 0
  return seededRandom(setup.seed ^ 0x51ed270b)() < 0.5 ? 0 : 1
}

/** A seed for one step of a game (a round's bar, a bot's choice), the same for everyone. */
export const stepSeed = (seed: number, step: number, salt = 0): number =>
  (seed ^ Math.imul(step + 1, 0x27d4eb2d) ^ Math.imul(salt + 1, 0x165667b1)) >>> 0

/** Packs small choices (0, 1, 2...) into one whole number, and back. */
export function packDigits(digits: readonly number[], base = 3): number {
  return digits.reduceRight((total, digit) => total * base + digit, 0)
}

export function unpackDigits(value: number, length: number, base = 3): number[] {
  const digits: number[] = []
  let rest = Math.max(0, Math.floor(value))
  for (let index = 0; index < length; index++) {
    digits.push(rest % base)
    rest = Math.floor(rest / base)
  }
  return digits
}

/** Settles a simple score game: one move each, the score itself. */
export function settleScores(moves: BothMoves, lowerWins = false): Settled | null {
  const a = moves[0][0]
  const b = moves[1][0]
  if (a === undefined || b === undefined) return null
  const winner: Player | null = a === b ? null : a > b !== lowerWins ? 0 : 1
  return { winner, scores: [a, b] }
}

/** Owed moves for a one-move score game. */
export const owedScores = (moves: BothMoves): Owed[] =>
  ([0, 1] as const).filter((player) => moves[player][0] === undefined).map((player) => ({ player, step: 0 }))
