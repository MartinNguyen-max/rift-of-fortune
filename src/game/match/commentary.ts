import { seededRandom } from '../random'
import { ROLE_LABELS } from '../roles'
import { ITEM_FIT_THRESHOLDS } from '../scoring/config'
import type { ChampionRating } from '../scoring/rateTeam'
import { opponent, type ChampionRef, type MapSpot, type MatchEvent, type MatchResult, type MatchTeams } from './types'

/** Two casters: one screams at everything, the other is tired of this team. */
export type Caster = 'hype' | 'analyst'

/** The player's team name. Lines are written so it reads well, e.g. "Your team takes Baron". */
export const PLAYER_TEAM_NAME = 'Your team'

export const CASTER_NAMES: Record<Caster, string> = { hype: 'Roary', analyst: 'Mortimer' }

export interface CommentaryLine {
  caster: Caster
  text: string
  /** True when the line roasts a pick or an item from the draft. */
  callback: boolean
}

/** One entry per match event: a caster line, or null when the event only shows in the kill feed. */
export type MatchLines = readonly (CommentaryLine | null)[]

export interface LineContext {
  /** The team that won or benefited from the event. */
  team: string
  enemy: string
  actor: string
  target: string
  /** The actor's role, e.g. "Support". */
  actorRole: string
  targetRole: string
  lane: string
  dragon: string
  /** Teamfight result, e.g. "4 for 1". */
  kills: string
  time: string
}

type Lines = (context: LineContext) => string[]

/** The big moments that get a caster line. Everything else only shows in the kill feed. */
export type LineKey =
  | 'firstBlood'
  | 'dragonSteal'
  | 'soul'
  | 'teamfight'
  | 'teamfightUpset'
  | 'ace'
  | 'pentakill'
  | 'baron'
  | 'baronSteal'
  | 'elder'
  | 'elderSteal'
  | 'nexus'
  | 'surrender'

/** Every line, per big moment and caster. One short sentence each, so they can be read at full speed. */
export const MATCH_LINES: Record<LineKey, Record<Caster, Lines>> = {
  firstBlood: {
    hype: ({ actor, target, team }) => [
      `FIRST BLOOD! ${actor} takes down ${target}!`,
      `First blood to ${actor}! The Rift wants more!`,
      `FIRST BLOOD for ${team}!`,
    ],
    analyst: ({ actor, target }) => [
      `First blood to ${actor}. ${target} walked in without vision.`,
      `${target} gives up first blood. A bold start.`,
      `First blood. ${target} will explain it in the lobby.`,
    ],
  },
  dragonSteal: {
    hype: ({ actor, dragon }) => [`STOLEN! ${actor} smites the ${dragon} Drake away!`, `NO WAY! ${actor} steals the dragon!`],
    analyst: ({ actor, enemy }) => [`${enemy} did the work. ${actor} pressed Smite.`, `${actor} steals it. ${enemy} is rethinking life.`],
  },
  soul: {
    hype: ({ team, dragon }) => [`DRAGON SOUL! ${team} claims the ${dragon} Soul!`, `FOUR DRAGONS! The ${dragon} Soul goes to ${team}!`],
    analyst: ({ team, enemy, dragon }) => [`${dragon} Soul to ${team}. ${enemy} forgot dragons exist.`],
  },
  teamfight: {
    hype: ({ team, actor, kills }) => [
      `TEAMFIGHT! ${team} wins it ${kills}!`,
      `What a fight! ${team} takes it ${kills}!`,
      `${actor} dives in! ${team} wins ${kills}!`,
    ],
    analyst: ({ team, enemy, actor, kills }) => [
      `${team} wins ${kills}. ${actor} did the heavy lifting.`,
      `${kills} for ${team}. ${enemy}'s plan was mostly hope.`,
      `${team} wins ${kills}. ${enemy} spent it in the fountain.`,
    ],
  },
  teamfightUpset: {
    hype: ({ team, kills }) => [`UNDERDOGS! ${team} wins it ${kills}!`, `HOW DID THEY WIN THAT?! ${kills} for ${team}!`],
    analyst: ({ team, kills }) => [`${team} wins a fight they shouldn't have. ${kills}.`],
  },
  ace: {
    hype: ({ team, enemy }) => [`ACE! ${team} wipes out all five!`, `IT'S AN ACE! ${enemy} is all grey screens!`],
    analyst: ({ enemy }) => [`All five of ${enemy} are dead. Time to read a book.`, `An ace. Judging by the items, deserved.`],
  },
  pentakill: {
    hype: ({ actor }) => [`PENTAKILL! ${actor} KILLS ALL FIVE!`, `${actor} GETS THE PENTA! CLIP IT!`],
    analyst: ({ actor }) => [`${actor} kills all five. I have no dry remark for that.`],
  },
  baron: {
    hype: ({ team }) => [`BARON goes down! ${team} has the purple buff!`, `${team} takes BARON! Here comes the push!`],
    analyst: ({ team, enemy }) => [`Baron to ${team}. ${enemy} is defending, emotionally too.`],
  },
  baronSteal: {
    hype: ({ actor, enemy }) => [`${actor} STEALS BARON! I NEED TO SIT DOWN!`, `BARON STOLEN! ${enemy} is in shock!`],
    analyst: ({ actor, enemy }) => [`${enemy} spent a minute on Baron. ${actor} spent one Smite.`],
  },
  elder: {
    hype: ({ team }) => [`ELDER DRAGON to ${team}! Executions incoming!`],
    analyst: ({ team }) => [`Elder to ${team}. Health bars are now a suggestion.`],
  },
  elderSteal: {
    hype: ({ actor }) => [`${actor} STEALS ELDER! THIS ISN'T OVER!`],
    analyst: ({ actor }) => [`${actor} steals Elder. Deleting my recap.`],
  },
  nexus: {
    hype: ({ team }) => [`THE NEXUS FALLS! ${team} WINS!`, `GG! ${team} destroys the Nexus!`],
    analyst: ({ team, enemy }) => [`That's the Nexus. GG, ${team}.`, `GG. ${enemy} can start blaming each other.`],
  },
  surrender: {
    hype: ({ team, enemy, time }) => [`${enemy} SURRENDERS! ${team} wins at ${time}!`],
    analyst: ({ enemy, time }) => [`${enemy} surrenders at ${time}. Wise.`, `${enemy} surrenders. Best team decision all game.`],
  },
}

/** Analyst lines that remember the draft. */
export const CALLBACK_LINES = {
  offRoleWins: (name: string, role: string) => [
    `${name} ${role}. Still a terrible pick. Somehow it works.`,
    `${name} ${role}, winning. Tier lists in shambles.`,
  ],
  offRoleDies: (name: string, role: string) => [
    `${name} ${role}. Some things are inevitable.`,
    `That's why ${name} doesn't play ${role}.`,
  ],
  badItemWins: (name: string, item: string) => [
    `${name} did that with ${item}. Imagine a real build.`,
    `${item} on ${name}, and it worked. Tell no one.`,
  ],
  badItemDies: (name: string, item: string) => [
    `That ${item} on ${name} did exactly nothing.`,
    `${name} with ${item}. The build was mistake one.`,
  ],
} as const

/** A share of eligible kills that get a draft roast. */
const CALLBACK_CHANCE = 0.45
/** At most this many roasts per match, so the feed stays short. */
export const ROASTS_PER_MATCH = 2
/** Big moments go to the hype caster this often. */
const HYPE_ON_BIG = 0.7

const LANE_NAMES: Partial<Record<MapSpot, string>> = { top: 'top lane', mid: 'mid lane', bot: 'bot lane' }

/** The player's team is called "Your team", which reads as "your team" mid-sentence. */
export const lowercaseYourMidSentence = (text: string): string => text.replace(/([^.!?]) Your team/g, '$1 your team')

/** "27:05". */
export function formatGameTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

/** The caster line for a big moment, or null for small events. */
export function lineKey({ kind, tags, big }: MatchEvent): LineKey | null {
  if (!big) return null
  const has = (tag: MatchEvent['tags'][number]) => tags.includes(tag)
  switch (kind) {
    case 'soloKill':
    case 'gank':
      return 'firstBlood'
    case 'teamfight':
      if (has('pentakill')) return 'pentakill'
      if (has('ace')) return 'ace'
      return has('upset') ? 'teamfightUpset' : 'teamfight'
    case 'dragon':
      return has('steal') ? 'dragonSteal' : 'soul'
    case 'baron':
      return has('steal') ? 'baronSteal' : 'baron'
    case 'elder':
      return has('steal') ? 'elderSteal' : 'elder'
    case 'nexus':
    case 'surrender':
      return kind
    default:
      return null
  }
}

type Issue = { kind: 'offRole'; role: string } | { kind: 'badItem'; item: string }

/** What the casters can roast a champion for: playing far off-role, or holding a terrible item. */
export function draftIssues(rating: ChampionRating): Issue[] {
  const issues: Issue[] = []
  if (rating.roleFit.kind === 'offRole' || rating.roleFit.kind === 'stretch') {
    issues.push({ kind: 'offRole', role: ROLE_LABELS[rating.role] })
  }
  const worst = [...rating.items].sort((a, b) => a.fit - b.fit)[0]
  if (worst && worst.fit <= ITEM_FIT_THRESHOLDS.bad) issues.push({ kind: 'badItem', item: worst.item.name })
  return issues
}

function callbackLines(name: string, issue: Issue, won: boolean): readonly string[] {
  if (issue.kind === 'offRole') return (won ? CALLBACK_LINES.offRoleWins : CALLBACK_LINES.offRoleDies)(name, issue.role)
  return (won ? CALLBACK_LINES.badItemWins : CALLBACK_LINES.badItemDies)(name, issue.item)
}

const KILL_KINDS: readonly MatchEvent['kind'][] = ['soloKill', 'gank', 'teamfight']

/**
 * A caster line for each big moment and a few draft roasts; null for every other event.
 * Uses its own seeded random so changing a line never changes how a match plays out.
 * Lines aren't repeated while there are unused variants.
 */
export function commentate(match: MatchResult, teams: MatchTeams): (CommentaryLine | null)[] {
  const random = seededRandom(match.seed ^ 0x5bd1e995)
  const used = new Set<string>()
  const roasted = new Set<string>()

  const champion = (ref: ChampionRef | null) =>
    ref ? teams[ref.side].rating.champions.find(({ role }) => role === ref.role) : undefined

  const pick = (lines: readonly string[]): string => {
    const fresh = lines.filter((line) => !used.has(line))
    const options = fresh.length > 0 ? fresh : lines
    const line = options[Math.floor(random() * options.length)] ?? ''
    used.add(line)
    return line
  }

  const roast = (event: MatchEvent): CommentaryLine | null => {
    if (roasted.size >= ROASTS_PER_MATCH || !KILL_KINDS.includes(event.kind) || event.tags.includes('escape')) return null
    if (random() >= CALLBACK_CHANCE) return null
    const candidates = [
      { rating: champion(event.actor), won: true },
      { rating: champion(event.target), won: false },
    ]
    for (const { rating, won } of candidates) {
      if (!rating) continue
      const issue = draftIssues(rating).find((option) => !roasted.has(`${rating.champion.id}:${option.kind}`))
      if (!issue) continue
      roasted.add(`${rating.champion.id}:${issue.kind}`)
      return { caster: 'analyst', text: pick(callbackLines(rating.champion.name, issue, won)), callback: true }
    }
    return null
  }

  return match.events.map((event) => {
    const key = lineKey(event)
    if (!key) return roast(event)
    const caster: Caster = random() < HYPE_ON_BIG ? 'hype' : 'analyst'
    const text = lowercaseYourMidSentence(pick(MATCH_LINES[key][caster](lineContext(event, teams))))
    return { caster, text, callback: false }
  })
}

/** A plain kill-feed description of any event, e.g. "Jinx killed Ahri". */
export function describeEvent(event: MatchEvent, teams: MatchTeams): string {
  const { team, enemy, actor, target, lane, dragon, kills } = lineContext(event, teams)
  const stolen = event.tags.includes('steal')
  const text = (() => {
    switch (event.kind) {
      case 'soloKill':
        return `${actor} killed ${target}`
      case 'gank':
        if (event.tags.includes('escape')) return `${actor} escaped ${target}'s gank`
        return event.tags.includes('counterGank') ? `${actor} turned the gank on ${target}` : `${actor} ganked ${target}`
      case 'teamfight':
        return `${team} won a fight ${kills}`
      case 'grubs':
        return `${team} took the Void Grubs`
      case 'herald':
        return `${team} took Rift Herald`
      case 'dragon':
        return stolen ? `${actor} stole the ${dragon} Drake` : `${team} took the ${dragon} Drake`
      case 'baron':
        return stolen ? `${actor} stole Baron` : `${team} took Baron`
      case 'elder':
        return stolen ? `${actor} stole the Elder Dragon` : `${team} took the Elder Dragon`
      case 'tower':
        return `${team} took a ${lane} tower`
      case 'inhibitor':
        return `${team} destroyed an inhibitor`
      case 'nexus':
        return `${team} destroyed the Nexus`
      case 'surrender':
        return `${enemy} surrendered`
    }
  })()
  return lowercaseYourMidSentence(text)
}

export function lineContext(event: MatchEvent, teams: MatchTeams): LineContext {
  const name = (ref: ChampionRef | null) =>
    ref ? (teams[ref.side].rating.champions.find(({ role }) => role === ref.role)?.champion.name ?? '') : ''
  const kills = event.fightKills
    ? `${event.fightKills[event.side]} for ${event.fightKills[opponent(event.side)]}`
    : ''
  return {
    team: teams[event.side].name,
    enemy: teams[opponent(event.side)].name,
    actor: name(event.actor),
    target: name(event.target),
    actorRole: event.actor ? ROLE_LABELS[event.actor.role] : '',
    targetRole: event.target ? ROLE_LABELS[event.target.role] : '',
    lane: LANE_NAMES[event.spot] ?? 'the jungle',
    dragon: event.dragon ?? '',
    kills,
    time: formatGameTime(event.time),
  }
}


/** The big stamp shown over the fight scene, e.g. "ACE!". Seen from the player's side for the end. */
export function momentTitle({ kind, tags, side }: MatchEvent): string {
  const has = (tag: MatchEvent['tags'][number]) => tags.includes(tag)
  switch (kind) {
    case 'soloKill':
    case 'gank':
      return 'First blood!'
    case 'teamfight':
      if (has('pentakill')) return 'Pentakill!'
      if (has('ace')) return 'Ace!'
      return has('upset') ? 'Upset!' : 'Teamfight!'
    case 'dragon':
      return has('steal') ? 'Stolen!' : 'Dragon Soul!'
    case 'baron':
      return has('steal') ? 'Baron stolen!' : 'Baron!'
    case 'elder':
      return has('steal') ? 'Elder stolen!' : 'Elder Dragon!'
    case 'nexus':
    case 'surrender':
      return side === 'blue' ? 'Victory!' : 'Defeat'
    default:
      return ''
  }
}
