import type { Role } from '../../data/types'
import type { TeamRating } from '../scoring/rateTeam'

/** Blue is the player (bottom-left base), red is the opponent. */
export type Side = 'blue' | 'red'
export const SIDES = ['blue', 'red'] as const satisfies readonly Side[]

export const opponent = (side: Side): Side => (side === 'blue' ? 'red' : 'blue')

export interface MatchTeam {
  name: string
  rating: TeamRating
}

export type MatchTeams = Record<Side, MatchTeam>

/** Points to one champion in the match. */
export interface ChampionRef {
  side: Side
  role: Role
}

/** Where on the map an event happens, for the map marker. */
export type MapSpot = 'top' | 'mid' | 'bot' | 'blueJungle' | 'redJungle' | 'dragon' | 'baron' | 'blueBase' | 'redBase'

export type MatchEventKind =
  | 'soloKill'
  | 'gank'
  | 'grubs'
  | 'herald'
  | 'dragon'
  | 'tower'
  | 'teamfight'
  | 'baron'
  | 'elder'
  | 'inhibitor'
  | 'nexus'
  | 'surrender'

/**
 * Extra facts about an event, used by the commentary and the end screen:
 * - `firstBlood`: the first kill of the game.
 * - `upset`: the side that was less likely to win this event won it.
 * - `steal`: an objective stolen by the losing side's jungler.
 * - `escape`: a gank where nobody died. `counterGank`: a gank where the jungler died instead.
 * - `ace`: all five enemies died. `pentakill`: one champion got all five kills.
 * - `soul`: the fourth dragon. `firstTower`: the first tower of the game.
 */
export type EventTag =
  | 'firstBlood'
  | 'upset'
  | 'steal'
  | 'escape'
  | 'counterGank'
  | 'ace'
  | 'pentakill'
  | 'soul'
  | 'firstTower'

export const DRAGON_KINDS = ['Infernal', 'Mountain', 'Ocean', 'Cloud', 'Hextech', 'Chemtech'] as const
export type DragonKind = (typeof DRAGON_KINDS)[number]

export interface SideScore {
  kills: number
  towers: number
  dragons: number
  barons: number
  inhibitors: number
  /** Total team gold, rounded to the nearest 100. */
  gold: number
}

export type Scoreboard = Record<Side, SideScore>

/** One champion killing another, in the order they happened. */
export interface Kill {
  killer: ChampionRef
  victim: ChampionRef
  /** Roles on the killer's side that helped. */
  assists: Role[]
}

export interface MatchEvent {
  /** Game time in seconds. */
  time: number
  kind: MatchEventKind
  /** The side that won or benefited from the event. */
  side: Side
  /** Who did it, e.g. the killer or the jungler who smited. */
  actor: ChampionRef | null
  /** Who it happened to, e.g. the champion who died. */
  target: ChampionRef | null
  /** Kills per side in a teamfight. */
  fightKills: Record<Side, number> | null
  /** Every kill in this event, for the live K/D/A and the fight scene. */
  kills: Kill[]
  dragon: DragonKind | null
  tags: EventTag[]
  /** Big moments get a bigger card in the feed. */
  big: boolean
  spot: MapSpot
  /** The score after this event. */
  score: Scoreboard
}

export interface KDA {
  kills: number
  deaths: number
  assists: number
}

export type ChampionStats = Record<Side, Record<Role, KDA>>

/** A lane on the Rift. */
export type Lane = 'top' | 'mid' | 'bot'
export const LANES = ['top', 'mid', 'bot'] as const satisfies readonly Lane[]

/** Multiplayer: the moments the players decide themselves with a mini-game, in game order. */
export type LiveEventKind = 'gank' | 'teamfight' | 'baron' | 'elder'

/** A live event forced into the match at `time`. `ganker` and `lane` are only used by the gank. */
export interface ScriptedEvent {
  kind: LiveEventKind
  time: number
  ganker: Side
  lane: Lane
  /** Extra gold for the side that wins the event, on top of what the event itself is worth. */
  gold: number
}

/**
 * Live events and the winners decided so far. The match plays until it reaches an event whose
 * winner isn't known yet, then pauses there.
 */
export interface MatchScript {
  events: readonly ScriptedEvent[]
  winners: readonly Side[]
}

/** A match that may be paused before a live event. */
export interface LiveMatch {
  seed: number
  events: MatchEvent[]
  stats: ChampionStats
  /** Index in `events` of each live event played so far. */
  scripted: number[]
  /** The live event (index in the script) the match is waiting for, or null when it is over. */
  pendingEvent: number | null
  /** Null while the match is still going. */
  winner: Side | null
  duration: number
}

export interface MatchResult {
  seed: number
  winner: Side
  /** Game time in seconds when the match ended. */
  duration: number
  events: MatchEvent[]
  stats: ChampionStats
}
