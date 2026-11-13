import type { ComponentType } from 'react'
import type { BothMoves, GameSetup, Player, Settled } from '../../game/minigames/versus'

/** A player as shown in a mini-game: you, the bot, or your Multiplayer opponent. */
export interface Contestant {
  name: string
  /** Data Dragon id of the champion they play. */
  champion: string
  isBot: boolean
}

/**
 * What every mini-game screen gets. The same screen runs against the bot (the bot's moves are
 * worked out from yours) and in Multiplayer (the opponent's moves come over the network).
 * Never show the opponent's moves before the game reveals them: the bot's are known up front.
 */
export interface MiniGameViewProps {
  setup: GameSetup
  /** You: 0 against the bot; in Multiplayer 0 for the host, 1 for the guest. */
  me: Player
  /** Both players' moves so far, by player. Yours show up here once sent. */
  moves: BothMoves
  /** Sends one of your moves. Only the first move for a step counts. */
  sendMove: (step: number, value: number) => void
  /** Call once, when the last moment of the game has been shown, so the result can cover it. */
  onShown: () => void
  /** Both players, by player. */
  players: readonly [Contestant, Contestant]
}

/** One tutorial picture (0, 1 or 2). Drawn small: about 6 rem square. */
export interface TutorialArtProps {
  step: 0 | 1 | 2
}

/** The end of a game, drawn as a picture instead of text (the bush they hid in, who got Baron). */
export interface RevealProps {
  setup: GameSetup
  me: Player
  moves: BothMoves
  settled: Settled
  players: readonly [Contestant, Contestant]
}

export interface MiniGameView {
  Game: ComponentType<MiniGameViewProps>
  TutorialArt: ComponentType<TutorialArtProps>
  /** Optional: a picture of how it ended, shown with the result. */
  Reveal?: ComponentType<RevealProps>
}
