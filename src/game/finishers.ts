/**
 * Finisher animations: a short clip of the winning champion after a mini-game (TFT chibi
 * finishers and Unbound animations). The clips are not in the repo: the owner adds them to
 * `public/finishers/` with the file names below. A missing clip is simply skipped.
 */
export interface Finisher {
  /** The clip's name in the owner's list. */
  title: string
  /** File in public/finishers/. */
  file: string
  /** Data Dragon skin number of the same skin, for the champion's art in the game (0 = none in LoL). */
  skin: number
}

const clip = (title: string, file: string, skin = 0): Finisher => ({ title, file: `${file}.mp4`, skin })

/** One finisher per champion (by Data Dragon id): the one picked when a champion has several. */
export const FINISHERS: Readonly<Record<string, Finisher>> = {
  Aatrox: clip('Chibi Blood Moon Aatrox', 'blood-moon-aatrox', 7),
  Ahri: clip('Chibi Spirit Blossom Ahri', 'spirit-blossom-ahri', 27),
  Akali: clip('Chibi KDA ALL OUT Akali', 'kda-all-out-akali', 32),
  Amumu: clip('Chibi Surprise Party Amumu', 'surprise-party-amumu', 8),
  Annie: clip('Chibi Panda Annie', 'panda-annie', 8),
  Ashe: clip('Chibi High Noon Ashe', 'high-noon-ashe', 17),
  Blitzcrank: clip('Chibi Space Groove Blitzcrank', 'space-groove-blitzcrank', 29),
  Briar: clip('Chibi Shork Cosplay Briar', 'shork-cosplay-briar'),
  Caitlyn: clip('Chibi Arcane Caitlyn', 'arcane-caitlyn', 28),
  Ekko: clip('Chibi Firelight Ekko', 'firelight-ekko', 36),
  Ezreal: clip('Chibi Battle Academia Ezreal', 'battle-academia-ezreal', 21),
  Garen: clip('God-King Garen Unbound', 'god-king-garen', 13),
  Gwen: clip('Chibi Prestige Cafe Cuties Gwen', 'cafe-cuties-gwen', 11),
  Irelia: clip('Chibi Divine Sword Irelia', 'divine-sword-irelia', 6),
  Janna: clip('Chibi Forecast Janna', 'forecast-janna', 5),
  Jhin: clip('Dark Cosmic Jhin Unbound', 'dark-cosmic-jhin', 5),
  Jinx: clip('Arcane Jinx Unbound', 'arcane-jinx', 37),
  Kaisa: clip('Chibi Headliner KDA Pop Stars Kaisa', 'kda-kaisa', 14),
  Katarina: clip('Chibi Battle Academia Katarina', 'battle-academia-katarina', 12),
  Kayle: clip('Chibi Aether Wing Kayle', 'aether-wing-kayle', 6),
  LeeSin: clip('Chibi Prestige Dragon Fist Lee Sin', 'dragon-fist-lee-sin', 3),
  Lillia: clip('Chibi Spirit Blossom Lillia', 'spirit-blossom-lillia', 1),
  Lulu: clip('Chibi Star Guardian Lulu', 'star-guardian-lulu', 6),
  Lux: clip('Chibi Star Guardian Lux', 'star-guardian-lux', 6),
  Malphite: clip('Chibi Mecha Malphite', 'mecha-malphite', 6),
  MissFortune: clip('Chibi Battle Bunny Miss Fortune', 'battle-bunny-miss-fortune', 31),
  Morgana: clip('Chibi Majestic Empress Morgana', 'majestic-empress-morgana', 17),
  Orianna: clip('Chibi T1 Orianna', 't1-orianna', 38),
  Riven: clip('Chibi Dawnbringer Riven', 'dawnbringer-riven', 16),
  Seraphine: clip('Chibi K/DA ALL OUT Seraphine', 'kda-all-out-seraphine', 1),
  Sett: clip('Chibi Heartsteel Sett', 'heartsteel-sett', 56),
  Sona: clip('Chibi Guqin Sona', 'guqin-sona', 4),
  Teemo: clip('Chibi Little Devil Teemo', 'little-devil-teemo', 14),
  Thresh: clip('High Noon Thresh Unbound', 'high-noon-thresh', 6),
  Tristana: clip('Chibi Dragon Trainer Tristana', 'dragon-trainer-tristana', 10),
  Vayne: clip('PROJECT: Vayne Unbound', 'project-vayne', 11),
  Vi: clip('Chibi Arcane Vi', 'arcane-vi', 29),
  Warwick: clip('Arcane Warwick Unbound', 'arcane-warwick', 56),
  Yasuo: clip('Chibi Dragonmancer Yasuo', 'dragonmancer-yasuo'),
  Yone: clip('Chibi Spirit Blossom Yone', 'spirit-blossom-yone', 1),
  Yuumi: clip('Chibi Bewitching Yuumi', 'bewitching-yuumi', 28),
  Zed: clip('Chibi PROJECT: Zed', 'project-zed', 3),
  Zoe: clip('Chibi Mythmaker Zoe', 'mythmaker-zoe'),
}

export const finisherFor = (champion: string): Finisher | null => FINISHERS[champion] ?? null

/** The clip's address in the built site. */
export const finisherUrl = (finisher: Finisher, base: string): string => `${base}finishers/${finisher.file}`
