import type { LiveEventKind } from '../../game/match/types'
import type { MiniGameId } from '../../game/minigames/catalog'
import { MINI_GAME_RULES } from '../../game/minigames/registry'
import { firstPlayer, type GameSetup, type Player } from '../../game/minigames/versus'

/** The two roles of the role games, first role first. */
const ROLE_WORDS: Partial<Record<MiniGameId, [string, string]>> = {
  gank: ['hide', 'guess'],
  shrooms: ['plant', 'walk'],
  cleaver: ['throw', 'dodge'],
}

/** One short line for the intro: which role you start with, e.g. "You hide first" or "You walk". */
export function roleNote(game: MiniGameId, setup: GameSetup, me: Player): string | undefined {
  const words = ROLE_WORDS[game]
  if (!words) return undefined
  const word = firstPlayer(setup) === me ? words[0] : words[1]
  const oneRole = MINI_GAME_RULES[game].chances === 2 && !setup.bothRoles
  return oneRole ? `You ${word}` : `You ${word} first`
}

/** What winning the event gives in the match, from your point of view. */
export function eventPrize(kind: LiveEventKind, won: boolean): string {
  switch (kind) {
    case 'gank':
      return won ? 'Your gank wins the lane!' : 'Their gank wins the lane.'
    case 'baron':
      return won ? 'Baron is yours!' : 'They take Baron.'
    case 'elder':
      return won ? 'Elder Dragon is yours!' : 'They take Elder Dragon.'
    case 'teamfight':
      return won ? 'You win the teamfight!' : 'They win the teamfight.'
  }
}

/** How long the coin spins before it lands, for a tie that must have a winner. */
export const COIN_FLIP_MS = 1800

/** In five lanes: which champion falls, or both live on a tie. */
export interface LaneMatchup {
  /** "Top lane". */
  label: string
  mine: string
  theirs: string
}

export function lanePrize({ mine, theirs }: LaneMatchup, outcome: 'won' | 'lost' | 'tie'): string {
  if (outcome === 'tie') return `${mine} and ${theirs} both live on.`
  return outcome === 'won' ? `Their ${theirs} falls!` : `Your ${mine} falls.`
}
