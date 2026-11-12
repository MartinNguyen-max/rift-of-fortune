export const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'] as const
export type Role = (typeof ROLES)[number]

export const CHAMPION_CLASSES = ['Assassin', 'Fighter', 'Mage', 'Marksman', 'Support', 'Tank'] as const
export type ChampionClass = (typeof CHAMPION_CLASSES)[number]

/** Ranked tiers from lowest to highest. Their emblems live in public/ranks/. */
export const RANK_TIERS = [
  'Iron',
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Emerald',
  'Diamond',
  'Master',
  'Grandmaster',
  'Challenger',
] as const
export type RankTier = (typeof RANK_TIERS)[number]

export type DamageType = 'AD' | 'AP'
export type AttackType = 'MELEE' | 'RANGED'

export interface Champion {
  id: string
  /** Riot's numeric champion id, e.g. "222" for Jinx. Names the champion's voice line file. */
  key: string
  name: string
  title: string
  image: string
  classes: ChampionClass[]
  /** Roles this champion is played in, most played first (the first one is their main role). */
  positions: Role[]
  damageType: DamageType
  attackType: AttackType
}

export const STAT_KEYS = [
  'abilityPower',
  'abilityHaste',
  'moveSpeed',
  'manaRegen',
  'attackDamage',
  'health',
  'armor',
  'mana',
  'magicResist',
  'healthRegen',
  'attackSpeed',
  'critChance',
  'critDamage',
  'omnivamp',
  'tenacity',
  'lethality',
  'healAndShieldPower',
  'armorPenetration',
  'lifeSteal',
  'magicPenetration',
] as const
export type StatKey = (typeof STAT_KEYS)[number]
export type ItemStats = Partial<Record<StatKey, number>>

export interface Item {
  id: string
  name: string
  image: string
  gold: number
  stats: ItemStats
  /** The ids of the components it is built from, in shop order. An id appears twice for two copies. */
  from: string[]
}

/** A component in an item recipe (Long Sword, B. F. Sword, ...). Used by the shop mini-game. */
export interface ItemComponent {
  id: string
  name: string
  image: string
  gold: number
}

export interface GameData {
  patch: string
  champions: Champion[]
  items: Item[]
  /** Every component that appears in a recipe of `items`, sorted by name. */
  components: ItemComponent[]
}

/** League minimap icons used in Match vs Bots. Saved to public/icons/ by `npm run data`. */
export const MAP_ICONS = {
  tower: 'icon_ui_tower_minimap',
  inhibitor: 'icon_ui_inhibitor_minimap_v2',
  nexus: 'icon_ui_nexus_minimap_v2',
  baron: 'baron',
  herald: 'riftherald',
  grubs: 'grub',
  dragon: 'dragon',
  elder: 'dragon_elder',
  infernal: 'dragon_infernal',
  mountain: 'dragon_mountain',
  ocean: 'dragon_ocean',
  cloud: 'dragon_cloud',
  hextech: 'dragon_hextech',
  chemtech: 'dragon_chemtech',
} as const
export type MapIcon = keyof typeof MAP_ICONS

/**
 * League client sounds and end-of-game crests, saved to public/ by `npm run data`.
 * Keys are the saved file names (without extension); values are paths on CommunityDragon.
 */
const POSTGAME = 'plugins/rcp-fe-lol-postgame/global/default'
const CHAMP_SELECT = 'plugins/rcp-fe-lol-champ-select/global/default/sounds'
export const SOUND_FILES = {
  reroll: `${CHAMP_SELECT}/sfx-cs-button-reroll-click.ogg`,
  'lock-in': `${CHAMP_SELECT}/sfx-cs-lockin-button-click.ogg`,
  'match-start': `${CHAMP_SELECT}/sfx-cs-draft-pick-intro.ogg`,
  victory: `${POSTGAME}/sfx-ranked-ui-promo-win.ogg`,
  defeat: `${POSTGAME}/sfx-ranked-ui-promo-loss.ogg`,
  'big-moment': `${POSTGAME}/sfx-eog-ui-edge-flare.ogg`,
  'rank-iron': `${POSTGAME}/sfx-eog-ui-iron-burst.ogg`,
  'rank-bronze': `${POSTGAME}/sfx-eog-ui-bronze-burst.ogg`,
  'rank-silver': `${POSTGAME}/sfx-eog-ui-silver-burst.ogg`,
  'rank-gold': `${POSTGAME}/sfx-eog-ui-gold-burst.ogg`,
  'rank-platinum': `${POSTGAME}/sfx-eog-ui-platinum-burst.ogg`,
  'rank-emerald': `${POSTGAME}/sfx-eog-ui-neutral-burst.ogg`,
  'rank-diamond': `${POSTGAME}/sfx-eog-ui-diamond-burst.ogg`,
  'rank-master': `${POSTGAME}/sfx-eog-ui-master-burst.ogg`,
  'rank-grandmaster': `${POSTGAME}/sfx-eog-ui-grandmaster-burst.ogg`,
  'rank-challenger': `${POSTGAME}/sfx-eog-ui-challenger-burst.ogg`,
  music: `${CHAMP_SELECT}/music-cs-draft-pick-base-layer-01.ogg`,
} as const
export type SoundName = keyof typeof SOUND_FILES

export const END_OF_GAME_ICONS = {
  victory: `${POSTGAME}/icon-sr-victory.png`,
  defeat: `${POSTGAME}/icon-sr-defeat.png`,
} as const

/** Each champion's champion select voice line on CommunityDragon, by Riot's numeric champion key. */
export const championVoicePath = (key: string): string =>
  `plugins/rcp-be-lol-game-data/global/default/v1/champion-choose-vo/${key}.ogg`
