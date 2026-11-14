/** The mini-games, in the order they are shown. Each is played against a bot, or as a live event in Multiplayer. */
export const MINI_GAME_IDS = ['duel', 'hook', 'combo', 'shrooms', 'forge', 'cleaver', 'gank', 'ult', 'execute', 'shadows', 'smite'] as const
export type MiniGameId = (typeof MINI_GAME_IDS)[number]

/** Three short captions, one under each tutorial picture. */
export type TutorialCaptions = readonly [string, string, string]

export interface MiniGameInfo {
  id: MiniGameId
  name: string
  /** Data Dragon id of your champion. */
  champion: string
  /** Data Dragon id of the bot's (or the opponent's) champion. */
  botChampion: string
  /** The bot's name in the game. */
  botName: string
  /** One short line for the card. */
  tagline: string
  /** The tutorial: three numbered pictures with a few words each. `live` when Multiplayer plays differently. */
  tutorial: { solo: TutorialCaptions; live?: TutorialCaptions }
}

export const MINI_GAMES: Record<MiniGameId, MiniGameInfo> = {
  duel: {
    id: 'duel',
    name: 'Headshot at High Noon',
    champion: 'Caitlyn',
    botChampion: 'Jhin',
    botName: 'High Noon Jhin',
    tagline: 'A Baron pops up. Shoot it first. Fastest hands in the West win.',
    tutorial: { solo: ['Wait… a Baron pops up', 'Tap it! Fastest tap wins', 'Too early = round lost. Best of 3'] },
  },
  hook: {
    id: 'hook',
    name: 'Rocket Grab Gold Rush',
    champion: 'Blitzcrank',
    botChampion: 'Thresh',
    botName: 'Thresh',
    tagline: 'The hook swings. Press GRAB when it points at a carry.',
    tutorial: {
      solo: ['The hook swings. Press GRAB!', 'Carries pay most, minions waste time', 'Most gold in 25 s wins'],
      live: ['The hook swings. Press GRAB!', 'Carries pay most, minions waste time', 'Most gold in 15 s wins'],
    },
  },
  combo: {
    id: 'combo',
    name: 'Combo Like a Riven Main',
    champion: 'Riven',
    botChampion: 'Riven',
    botName: 'Riven Main',
    tagline: 'Watch Riven’s combo, then copy it fast. Three new combos: 4, 6 and 7 keys.',
    tutorial: { solo: ['Watch Riven’s combo', 'Repeat it: Q W E R', '3 new combos: 4, 6, 7 keys. Most right wins'] },
  },
  shrooms: {
    id: 'shrooms',
    name: 'Shroom Hopscotch',
    champion: 'Teemo',
    botChampion: 'MasterYi',
    botName: 'Master Yi',
    tagline: 'Plant 3 shrooms in Yi’s path, then walk his. Every boom counts.',
    tutorial: {
      solo: ['Plant 3 shrooms, one per column', 'Walk across. A boom won’t stop you', 'Boom: +1 planter. Dodge: +1 walker'],
      live: ['Plant 3 shrooms, one per column', 'Walk theirs. Watch yours live', 'Boom: +1 planter. Dodge: +1 walker'],
    },
  },
  forge: {
    id: 'forge',
    name: 'Gwen’s Rush Order',
    champion: 'Gwen',
    botChampion: 'Gwen',
    botName: 'Bot Gwen',
    tagline: 'Snip snip! Stitch 3 items together from their parts. Fastest needle wins.',
    tutorial: { solo: ['An item to stitch', 'Tap its parts. Wrong part +2 s', '3 items. Fastest needle wins'] },
  },
  cleaver: {
    id: 'cleaver',
    name: 'Katarina’s Dagger Dance',
    champion: 'Katarina',
    botChampion: 'Katarina',
    botName: 'Blood Moon Katarina',
    tagline: 'Throw daggers, dodge daggers. Three hits and she goes down.',
    tutorial: { solo: ['THROW: hit their spot', 'DODGE: move 1 spot', '3 hits wins'] },
  },
  gank: {
    id: 'gank',
    name: 'I Was Hiding',
    champion: 'Shaco',
    botChampion: 'Rengar',
    botName: 'Rengar',
    tagline: 'Hide in a bush. Guess their bush. Mind games only.',
    tutorial: {
      solo: ['Hide in a bush', 'Guess where they hide', 'Right guess = 1 point. Most points wins'],
      live: ['Hide in a bush', 'Guess where they hide', 'Right guess wins the gank'],
    },
  },
  ult: {
    id: 'ult',
    name: 'Unstoppable Force',
    champion: 'Malphite',
    botChampion: 'Amumu',
    botName: 'Amumu',
    tagline: 'Land the teamfight ult. Dead center or bust.',
    tutorial: {
      solo: ['The marker sweeps the bar', 'Tap ULT in the gold zone', 'Center = 100. Best of 3 bars'],
      live: ['The marker sweeps the bar', 'Tap ULT in the gold zone', 'Center = 100. Higher wins'],
    },
  },
  execute: {
    id: 'execute',
    name: 'Noxian Guillotine',
    champion: 'Darius',
    botChampion: 'Draven',
    botName: 'Draven',
    tagline: 'Eight enemies, up for a blink. Dunk the low ones, never the tank. Chain the penta.',
    tutorial: { solo: ['8 enemies, each up for a blink', 'Tap the low one. Never the full-health tank', 'In a row: +1, +2… up to +5 a kill'] },
  },
  shadows: {
    id: 'shadows',
    name: 'Shadow Shuffle',
    champion: 'Zed',
    botChampion: 'Akali',
    botName: 'Akali',
    tagline: 'One Zed, two shadows, a blur of swaps. Find the real one first.',
    tutorial: {
      solo: ['Watch the real Zed', 'The shadows swap fast. Follow him', 'Tap Zed first. Fastest right pick wins'],
      live: ['Watch the real Zed', 'The same shuffle for both of you', 'Tap Zed first. Fastest right pick wins'],
    },
  },
  smite: {
    id: 'smite',
    name: 'Baron Steal',
    champion: 'LeeSin',
    botChampion: 'Nunu',
    botName: 'Nunu & Willump',
    tagline: 'Smite deals 1,600. The moment Baron drops that low, steal it first.',
    tutorial: {
      solo: ['Baron loses health in small hits', 'Smite deals 1,600: hit it at 1,600 or less', 'First smite steals it. Baron, then Elder'],
      live: ['Baron loses health in small hits', 'Smite deals 1,600: hit it at 1,600 or less', 'First smite steals it. Too early = no steal'],
    },
  },
}

export const parseMiniGameId = (value: string | undefined): MiniGameId | null =>
  MINI_GAME_IDS.find((id) => id === value) ?? null

export const isMiniGameId = (value: unknown): value is MiniGameId =>
  typeof value === 'string' && (MINI_GAME_IDS as readonly string[]).includes(value)

/** The tutorial captions for a variant. */
export const tutorialCaptions = (info: MiniGameInfo, live: boolean): TutorialCaptions =>
  (live ? info.tutorial.live : undefined) ?? info.tutorial.solo
