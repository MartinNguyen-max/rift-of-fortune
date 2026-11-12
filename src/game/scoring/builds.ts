import type { Champion } from '../../data/types'

/**
 * How champions actually build, written from game knowledge (no public data source lists
 * real builds). Each champion has one or two build profiles; each item lists the profiles that
 * buy it. An item fits a champion when one of the champion's profiles buys it.
 */
export const BUILD_PROFILES = [
  'crit',
  'onHit',
  'adCaster',
  'lethality',
  'bruiser',
  'skirmisher',
  'tank',
  'engage',
  'apBurst',
  'apAssassin',
  'battlemage',
  'apOnHit',
  'enchanter',
] as const
export type BuildProfile = (typeof BUILD_PROFILES)[number]

export const BUILD_PROFILE_LABELS: Record<BuildProfile, string> = {
  crit: 'crit marksman',
  onHit: 'on-hit attacker',
  adCaster: 'AD caster',
  lethality: 'lethality assassin',
  bruiser: 'bruiser',
  skirmisher: 'duelist',
  tank: 'tank',
  engage: 'engage support',
  apBurst: 'burst mage',
  apAssassin: 'AP assassin',
  battlemage: 'battlemage',
  apOnHit: 'AP on-hit',
  enchanter: 'enchanter',
}

/** Who buys each item, by Data Dragon item id. */
export const ITEM_BUYERS: Record<string, readonly BuildProfile[]> = {
  '8020': ['tank', 'engage'], // Abyssal Mask
  '2522': ['apBurst', 'enchanter'], // Actualizer
  '3003': ['apBurst', 'battlemage'], // Archangel's Staff
  '3504': ['enchanter'], // Ardent Censer
  '6696': ['lethality', 'adCaster'], // Axiom Arc
  '2524': ['engage'], // Bandlepipes
  '3102': ['apBurst', 'apAssassin'], // Banshee's Veil
  '2520': ['lethality', 'adCaster'], // Bastionbreaker
  '3071': ['bruiser', 'skirmisher', 'adCaster'], // Black Cleaver
  '2503': ['apBurst', 'battlemage'], // Blackfire Torch
  '3153': ['onHit', 'skirmisher'], // Blade of The Ruined King
  '8010': ['battlemage'], // Bloodletter's Curse
  '3072': ['crit'], // Bloodthirster
  '6609': ['bruiser'], // Chempunk Chainsword
  '4629': ['battlemage', 'apAssassin', 'apBurst'], // Cosmic Drive
  '3137': ['apBurst', 'apAssassin'], // Cryptbloom
  '6621': ['enchanter'], // Dawncore
  '3742': ['tank', 'bruiser', 'engage'], // Dead Man's Plate
  '6333': ['bruiser', 'skirmisher'], // Death's Dance
  '2510': ['apOnHit', 'battlemage'], // Dusk and Dawn
  '6620': ['enchanter'], // Echoes of Helia
  '6692': ['bruiser', 'lethality', 'adCaster'], // Eclipse
  '3814': ['lethality'], // Edge of Night
  '2517': ['bruiser', 'skirmisher'], // Endless Hunger
  '3508': ['crit', 'adCaster'], // Essence Reaver
  '3073': ['bruiser', 'skirmisher'], // Experimental Hexplate
  '2512': ['crit'], // Fiendhunter Bolts
  '4401': ['tank', 'engage'], // Force of Nature
  '3110': ['tank', 'engage'], // Frozen Heart
  '3026': ['crit', 'skirmisher'], // Guardian Angel
  '3124': ['onHit', 'apOnHit'], // Guinsoo's Rageblade
  '3084': ['tank'], // Heartsteel
  '2523': ['crit'], // Hexoptics C44
  '3146': ['apAssassin', 'battlemage', 'apOnHit'], // Hextech Gunblade
  '3152': ['apAssassin', 'apBurst'], // Hextech Rocketbelt
  '6664': ['tank'], // Hollow Radiance
  '4628': ['apBurst'], // Horizon Focus
  '6697': ['lethality'], // Hubris
  '3181': ['skirmisher', 'bruiser'], // Hullbreaker
  '6662': ['tank', 'adCaster', 'bruiser'], // Iceborn Gauntlet
  '6673': ['crit'], // Immortal Shieldbow
  '4005': ['enchanter'], // Imperial Mandate
  '3031': ['crit'], // Infinity Edge
  '6665': ['tank', 'engage'], // Jak'Sho, The Protean
  '2504': ['tank', 'bruiser'], // Kaenic Rookern
  '3109': ['engage'], // Knight's Vow
  '6672': ['onHit', 'crit'], // Kraken Slayer
  '6653': ['battlemage', 'apBurst'], // Liandry's Torment
  '3100': ['apAssassin', 'apOnHit'], // Lich Bane
  '3190': ['engage'], // Locket of the Iron Solari
  '3036': ['crit'], // Lord Dominik's Regards
  '6655': ['apBurst', 'apAssassin'], // Luden's Echo
  '3118': ['apBurst', 'battlemage'], // Malignance
  '3004': ['adCaster'], // Manamune
  '3156': ['bruiser', 'skirmisher'], // Maw of Malmortius
  '3139': ['crit'], // Mercurial Scimitar
  '3222': ['enchanter'], // Mikael's Blessing
  '6617': ['enchanter'], // Moonstone Renewer
  '3165': ['apBurst', 'battlemage'], // Morellonomicon
  '3033': ['crit'], // Mortal Reminder
  '3115': ['apOnHit'], // Nashor's Tooth
  '6675': ['crit'], // Navori Flickerblade
  '2501': ['bruiser'], // Overlord's Bloodmail
  '3046': ['crit'], // Phantom Dancer
  '6698': ['lethality'], // Profane Hydra
  '2525': ['tank'], // Protoplasm Harness
  '3089': ['apBurst', 'apAssassin', 'apOnHit', 'battlemage'], // Rabadon's Deathcap
  '3143': ['tank', 'engage'], // Randuin's Omen
  '3094': ['crit'], // Rapid Firecannon
  '3074': ['bruiser', 'skirmisher'], // Ravenous Hydra
  '3107': ['enchanter'], // Redemption
  '4633': ['battlemage', 'apOnHit'], // Riftmaker
  '6657': ['battlemage'], // Rod of Ages
  '3085': ['crit', 'onHit'], // Runaan's Hurricane
  '3116': ['battlemage', 'apBurst'], // Rylai's Crystal Scepter
  '6695': ['lethality'], // Serpent's Fang
  '6694': ['lethality', 'adCaster'], // Serylda's Grudge
  '4645': ['apBurst', 'apAssassin'], // Shadowflame
  '2065': ['enchanter'], // Shurelya's Battlesong
  '3161': ['bruiser', 'adCaster'], // Spear of Shojin
  '3065': ['tank', 'bruiser'], // Spirit Visage
  '6616': ['enchanter'], // Staff of Flowing Water
  '3087': ['crit', 'onHit'], // Statikk Shiv
  '3053': ['bruiser', 'skirmisher'], // Sterak's Gage
  '3095': ['crit'], // Stormrazor
  '4646': ['apAssassin', 'apBurst'], // Stormsurge
  '6631': ['bruiser'], // Stridebreaker
  '6610': ['bruiser', 'skirmisher'], // Sundered Sky
  '3068': ['tank'], // Sunfire Aegis
  '3302': ['onHit', 'apOnHit', 'skirmisher'], // Terminus
  '6676': ['lethality', 'crit'], // The Collector
  '3075': ['tank'], // Thornmail
  '3748': ['bruiser'], // Titanic Hydra
  '3078': ['bruiser', 'skirmisher', 'adCaster'], // Trinity Force
  '3179': ['lethality'], // Umbral Glaive
  '2502': ['tank'], // Unending Despair
  '3135': ['apBurst', 'apAssassin', 'battlemage', 'apOnHit'], // Void Staff
  '6699': ['lethality', 'adCaster'], // Voltaic Cyclosword
  '3083': ['tank'], // Warmog's Armor
  '3119': ['tank'], // Winter's Approach
  '3091': ['onHit', 'skirmisher'], // Wit's End
  '3142': ['lethality', 'adCaster'], // Youmuu's Ghostblade
  '3032': ['crit'], // Yun Tal Wildarrows
  '3050': ['engage'], // Zeke's Convergence
  '3157': ['apBurst', 'apAssassin', 'battlemage', 'apOnHit'], // Zhonya's Hourglass
}

/** How each champion builds, by Data Dragon champion id: main profile first. */
export const CHAMPION_BUILDS: Record<string, readonly BuildProfile[]> = {
  Aatrox: ['bruiser'],
  Ahri: ['apAssassin', 'apBurst'],
  Akali: ['apAssassin'],
  Akshan: ['crit', 'lethality'],
  Alistar: ['engage'],
  Ambessa: ['bruiser'],
  Amumu: ['tank', 'battlemage'],
  Anivia: ['apBurst'],
  Annie: ['apBurst'],
  Aphelios: ['crit'],
  Ashe: ['crit', 'onHit'],
  AurelionSol: ['apBurst', 'battlemage'],
  Aurora: ['apBurst', 'apAssassin'],
  Azir: ['apBurst', 'apOnHit'],
  Bard: ['engage', 'enchanter'],
  Belveth: ['skirmisher', 'onHit'],
  Blitzcrank: ['engage'],
  Brand: ['apBurst', 'battlemage'],
  Braum: ['engage'],
  Briar: ['bruiser', 'lethality'],
  Caitlyn: ['crit'],
  Camille: ['bruiser', 'skirmisher'],
  Cassiopeia: ['battlemage'],
  Chogath: ['tank', 'battlemage'],
  Corki: ['adCaster', 'crit'],
  Darius: ['bruiser'],
  Diana: ['apAssassin', 'battlemage'],
  DrMundo: ['tank'],
  Draven: ['crit'],
  Ekko: ['apAssassin'],
  Elise: ['apAssassin'],
  Evelynn: ['apAssassin'],
  Ezreal: ['adCaster'],
  Fiddlesticks: ['apBurst', 'battlemage'],
  Fiora: ['skirmisher', 'bruiser'],
  Fizz: ['apAssassin'],
  Galio: ['tank', 'battlemage'],
  Gangplank: ['crit', 'adCaster'],
  Garen: ['bruiser'],
  Gnar: ['bruiser', 'tank'],
  Gragas: ['battlemage', 'tank'],
  Graves: ['crit', 'lethality'],
  Gwen: ['apOnHit', 'battlemage'],
  Hecarim: ['bruiser'],
  Heimerdinger: ['apBurst'],
  Hwei: ['apBurst'],
  Illaoi: ['bruiser'],
  Irelia: ['skirmisher', 'onHit'],
  Ivern: ['enchanter'],
  Janna: ['enchanter'],
  JarvanIV: ['bruiser', 'lethality'],
  Jax: ['skirmisher', 'onHit'],
  Jayce: ['adCaster', 'lethality'],
  Jhin: ['crit', 'lethality'],
  Jinx: ['crit'],
  KSante: ['tank', 'bruiser'],
  Kaisa: ['onHit', 'apOnHit'],
  Kalista: ['onHit'],
  Karma: ['enchanter', 'apBurst'],
  Karthus: ['apBurst'],
  Kassadin: ['apAssassin', 'battlemage'],
  Katarina: ['apAssassin', 'apOnHit'],
  Kayle: ['apOnHit'],
  Kayn: ['lethality', 'bruiser'],
  Kennen: ['apBurst', 'battlemage'],
  Khazix: ['lethality'],
  Kindred: ['crit', 'onHit'],
  Kled: ['bruiser'],
  KogMaw: ['onHit', 'apOnHit'],
  Leblanc: ['apAssassin'],
  LeeSin: ['bruiser', 'lethality'],
  Leona: ['engage'],
  Lillia: ['battlemage'],
  Lissandra: ['apBurst'],
  Lucian: ['crit', 'adCaster'],
  Lulu: ['enchanter'],
  Lux: ['apBurst'],
  Malphite: ['tank', 'apBurst'],
  Malzahar: ['apBurst', 'battlemage'],
  Maokai: ['tank', 'engage'],
  MasterYi: ['onHit', 'crit'],
  Mel: ['apBurst'],
  Milio: ['enchanter'],
  MissFortune: ['crit', 'lethality'],
  Mordekaiser: ['battlemage'],
  Morgana: ['apBurst', 'enchanter'],
  Nami: ['enchanter'],
  Nasus: ['bruiser', 'tank'],
  Nautilus: ['engage'],
  Neeko: ['apBurst'],
  Nidalee: ['apAssassin'],
  Nilah: ['crit'],
  Nocturne: ['bruiser', 'lethality'],
  Nunu: ['tank', 'battlemage'],
  Naafiri: ['lethality'],
  Olaf: ['bruiser'],
  Orianna: ['apBurst'],
  Ornn: ['tank'],
  Pantheon: ['lethality', 'bruiser'],
  Poppy: ['tank', 'bruiser'],
  Pyke: ['lethality', 'engage'],
  Qiyana: ['lethality'],
  Quinn: ['lethality', 'crit'],
  Rakan: ['engage', 'enchanter'],
  Rammus: ['tank'],
  RekSai: ['bruiser'],
  Rell: ['engage'],
  Renata: ['enchanter'],
  Renekton: ['bruiser'],
  Rengar: ['lethality'],
  Riven: ['bruiser', 'lethality'],
  Rumble: ['battlemage'],
  Ryze: ['battlemage'],
  Samira: ['crit'],
  Sejuani: ['tank'],
  Senna: ['lethality', 'enchanter'],
  Seraphine: ['apBurst', 'enchanter'],
  Sett: ['bruiser', 'tank'],
  Shaco: ['lethality', 'apAssassin'],
  Shen: ['tank'],
  Shyvana: ['bruiser', 'battlemage'],
  Singed: ['tank', 'battlemage'],
  Sion: ['tank'],
  Sivir: ['crit'],
  Skarner: ['tank'],
  Smolder: ['crit', 'adCaster'],
  Sona: ['enchanter'],
  Soraka: ['enchanter'],
  Swain: ['battlemage'],
  Sylas: ['battlemage', 'apAssassin'],
  Syndra: ['apBurst'],
  TahmKench: ['tank'],
  Taliyah: ['apBurst'],
  Talon: ['lethality'],
  Taric: ['engage', 'enchanter'],
  Teemo: ['apOnHit', 'apBurst'],
  Thresh: ['engage'],
  Tristana: ['crit'],
  Trundle: ['bruiser', 'onHit'],
  Tryndamere: ['crit', 'skirmisher'],
  TwistedFate: ['apBurst', 'apOnHit'],
  Twitch: ['crit', 'onHit'],
  Udyr: ['bruiser', 'tank'],
  Urgot: ['bruiser'],
  Varus: ['onHit', 'lethality'],
  Vayne: ['onHit', 'crit'],
  Veigar: ['apBurst'],
  Velkoz: ['apBurst'],
  Vex: ['apBurst'],
  Vi: ['bruiser', 'lethality'],
  Viego: ['skirmisher', 'bruiser'],
  Viktor: ['apBurst'],
  Vladimir: ['battlemage'],
  Volibear: ['bruiser', 'tank'],
  Warwick: ['bruiser', 'skirmisher'],
  MonkeyKing: ['bruiser'],
  Xayah: ['crit'],
  Xerath: ['apBurst'],
  XinZhao: ['bruiser'],
  Yasuo: ['crit', 'skirmisher'],
  Yone: ['crit', 'skirmisher'],
  Yorick: ['bruiser'],
  Yunara: ['crit', 'onHit'],
  Yuumi: ['enchanter'],
  Zac: ['tank'],
  Zed: ['lethality'],
  Zeri: ['crit'],
  Ziggs: ['apBurst'],
  Zilean: ['enchanter', 'apBurst'],
  Zoe: ['apBurst'],
  Zyra: ['apBurst', 'battlemage'],
}

/** A guess from Riot's class for champions not in the table yet (e.g. a brand-new release). */
export function guessBuildProfiles({ classes, damageType }: Champion): BuildProfile[] {
  const ap = damageType === 'AP'
  switch (classes[0]) {
    case 'Marksman':
      return ['crit']
    case 'Assassin':
      return [ap ? 'apAssassin' : 'lethality']
    case 'Mage':
      return ['apBurst', 'battlemage']
    case 'Tank':
      return ['tank']
    case 'Support':
      return [ap ? 'enchanter' : 'engage']
    default:
      return [ap ? 'battlemage' : 'bruiser']
  }
}

export function buildProfiles(champion: Champion): readonly BuildProfile[] {
  return CHAMPION_BUILDS[champion.id] ?? guessBuildProfiles(champion)
}

/** The item's buyers, or null for an item the table doesn't know yet (e.g. a brand-new item). */
export const itemBuyers = (itemId: string): readonly BuildProfile[] | null => ITEM_BUYERS[itemId] ?? null
