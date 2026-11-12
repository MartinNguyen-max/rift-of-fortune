/** The mini-games, in the order they are shown. Each one is played against a bot for now. */
export const MINI_GAME_IDS = ['duel', 'hook', 'combo', 'shrooms', 'forge', 'cleaver'] as const
export type MiniGameId = (typeof MINI_GAME_IDS)[number]

export interface MiniGameInfo {
  id: MiniGameId
  name: string
  /** Data Dragon id of the champion on the card. */
  champion: string
  /** Data Dragon id of the bot's champion. */
  botChampion: string
  /** The bot's name in the game. */
  botName: string
  /** One short line for the card. */
  tagline: string
  /** The rules, a few short lines shown before the game starts. */
  howTo: string[]
}

export const MINI_GAMES: Record<MiniGameId, MiniGameInfo> = {
  duel: {
    id: 'duel',
    name: 'Headshot at High Noon',
    champion: 'Caitlyn',
    botChampion: 'Jhin',
    botName: 'High Noon Jhin',
    tagline: 'Wait for DRAW, then shoot. Fastest hands in the West win.',
    howTo: [
      'Wait for the word DRAW!',
      'Then click, tap or press Space as fast as you can.',
      'Shoot before DRAW and you lose the round.',
      'First to 2 rounds wins.',
    ],
  },
  hook: {
    id: 'hook',
    name: 'Rocket Grab Gold Rush',
    champion: 'Blitzcrank',
    botChampion: 'Thresh',
    botName: 'Thresh',
    tagline: 'Swing, aim, grab. Squishy carries pay more than tanks.',
    howTo: [
      'Your hook swings back and forth. Click, tap or press Space to fire.',
      'Carries are small and light: lots of gold. Tanks are big and heavy: slow to pull.',
      'Minions are in the way. Grab one and you waste precious seconds.',
      'Rocket Grab has a cooldown. Most gold when the timer runs out wins.',
    ],
  },
  combo: {
    id: 'combo',
    name: 'Udyr Has No Combo',
    champion: 'Udyr',
    botChampion: 'Udyr',
    botName: 'Bot Udyr',
    tagline: 'No combo. Just spam. Remember the spam.',
    howTo: [
      'Udyr spams Q, W, E and R. Watch the order.',
      'Then repeat it with the buttons or your keyboard.',
      'Every round the spam gets one key longer.',
      'One wrong key and your wrists give out. Longest spam wins.',
    ],
  },
  shrooms: {
    id: 'shrooms',
    name: 'Shroom Hopscotch',
    champion: 'Teemo',
    botChampion: 'MasterYi',
    botName: 'Master Yi',
    tagline: 'Plant 3 shrooms. Then walk through the enemy’s.',
    howTo: [
      'First you are Teemo: hide 3 shrooms on a path of 5 steps.',
      'The bot walks it, jumping left or right each step.',
      'Then the bot plants, and you walk. Pick left or right in time!',
      'Whoever walks further wins. Captain Teemo on duty.',
    ],
  },
  forge: {
    id: 'forge',
    name: 'Ornn’s Rush Order',
    champion: 'Ornn',
    botChampion: 'Ornn',
    botName: 'Bot Ornn',
    tagline: 'Build 3 items from their parts. Fastest smith wins.',
    howTo: [
      'An item shows up. Click the parts it is built from.',
      'A wrong part costs you 2 seconds.',
      'Build 3 items in a row.',
      'Beat the bot’s time. Ornn does not do refunds.',
    ],
  },
  cleaver: {
    id: 'cleaver',
    name: 'Mundo Goes Where He Pleases',
    champion: 'DrMundo',
    botChampion: 'DrMundo',
    botName: 'El Macho Mundo',
    tagline: 'Throw cleavers, dodge cleavers. Three hits and Mundo goes down.',
    howTo: [
      'Each round one Mundo throws a cleaver and the other dodges. You switch every round.',
      'Pick a lane: top, mid or bot. You have 3 seconds.',
      'Thrower: guess where they go. Dodger: be anywhere else.',
      'Hit the other Mundo 3 times to win.',
    ],
  },
}

export const parseMiniGameId = (value: string | undefined): MiniGameId | null =>
  MINI_GAME_IDS.find((id) => id === value) ?? null

/** Who won a mini-game against the bot. */
export type MiniGameWinner = 'player' | 'bot' | 'draw'

/** The end of a mini-game: who won and each side's score as text ("312 ms", "850 gold"). */
export interface MiniGameResult {
  winner: MiniGameWinner
  player: string
  bot: string
}

/** Compares two scores. `lowerWins` for times. */
export function winnerByScore(player: number, bot: number, lowerWins = false): MiniGameWinner {
  if (player === bot) return 'draw'
  return player > bot !== lowerWins ? 'player' : 'bot'
}
