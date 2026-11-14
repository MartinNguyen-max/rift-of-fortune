/** The mini-games, in the order they are shown. Each is played against a bot, or as a live event in Multiplayer. */
export const MINI_GAME_IDS = ['duel', 'hook', 'combo', 'shrooms', 'forge', 'cleaver', 'gank', 'ult', 'execute', 'shadows', 'race', 'windwall', 'devour', 'destiny', 'paranoia', 'smite'] as const
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
    botChampion: 'Ezreal',
    botName: 'Ezreal',
    tagline: 'Plant 3 shrooms in Ezreal’s path, then walk his. Every boom counts.',
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
    champion: 'Akali',
    botChampion: 'Warwick',
    botName: 'Warwick',
    tagline: 'Akali hides in a bush, Warwick sniffs her out. Then swap. Mind games only.',
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
    name: 'Demacian Justice',
    champion: 'Garen',
    botChampion: 'Vayne',
    botName: 'Vayne',
    tagline: 'Eight enemies, low on health, up for a blink. Drop the sword on them all and chain the penta.',
    tutorial: { solo: ['8 enemies, each up for a blink', 'Tap it: the sword falls', 'In a row: +1, +2… up to +5 a kill'] },
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
  race: {
    id: 'race',
    name: 'Unstoppable Onslaught',
    champion: 'Sion',
    botChampion: 'Vi',
    botName: 'Vi',
    tagline: 'Hold to charge, let go to slide. Stop on the enemy team, not their tower.',
    tutorial: {
      solo: ['Hold: Sion charges, faster and faster', 'Let go: he slides. Stop in the gold zone', 'Middle = 100. Hit the tower = 0. 3 runs'],
      live: ['Hold: Sion charges, faster and faster', 'Let go: he slides. Stop in the gold zone', 'Same 3 tracks for both. Most points wins'],
    },
  },
  windwall: {
    id: 'windwall',
    name: 'Wind Wall',
    champion: 'Yasuo',
    botChampion: 'Yone',
    botName: 'Yone',
    tagline: 'Skillshots from every side, faster and faster. Wall them before they land.',
    tutorial: {
      solo: ['A shooter shows up: a shot is coming', 'Tap that side: Wind Wall!', 'Most blocked wins, then the faster'],
      live: ['A shooter shows up: a shot is coming', 'Tap that side: Wind Wall!', 'Same volley for both. Most blocked wins'],
    },
  },
  devour: {
    id: 'devour',
    name: 'Devour',
    champion: 'TahmKench',
    botChampion: 'Yuumi',
    botName: 'Yuumi',
    tagline: 'Jinx’s rocket is coming for your carry. Swallow them at the last second.',
    tutorial: {
      solo: ['Jinx fires. The rocket speeds up', 'Devour your carry just before it hits', 'Closer = more points. Early = spat out'],
      live: ['Jinx fires. The rocket speeds up', 'Devour your carry just before it hits', 'Same rockets. Closer = more points'],
    },
  },
  destiny: {
    id: 'destiny',
    name: 'Destiny',
    champion: 'TwistedFate',
    botChampion: 'Ahri',
    botName: 'Ahri',
    tagline: 'Twisted Fate shows a card, then Gates in. Is it the truth or a bluff?',
    tutorial: {
      solo: ['TF shows a card over a lane', 'He Gates there, or bluffs', 'Guarded +1 · card lane +2 · bluff +1'],
      live: ['TF shows a card over a lane', 'He Gates there, or bluffs', 'Guarded +1 · card lane +2 · bluff +1'],
    },
  },
  paranoia: {
    id: 'paranoia',
    name: 'Paranoia',
    champion: 'Lux',
    botChampion: 'Ekko',
    botName: 'Ekko',
    tagline: 'Lights out. Nocturne flickers through the dark. Call his lane before he lands.',
    tutorial: {
      solo: ['Lights out: Nocturne flickers', 'Watch out, he can turn', 'Call his lane. Most right, then fastest'],
      live: ['Lights out: Nocturne flickers', 'The same flight for both of you', 'Call his lane. Most right, then fastest'],
    },
  },
  smite: {
    id: 'smite',
    name: 'Baron Steal',
    champion: 'LeeSin',
    botChampion: 'Lillia',
    botName: 'Lillia',
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
