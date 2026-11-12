import { seededRandom } from '../random'
import { ROLE_LABELS } from '../roles'
import { ITEM_FIT_THRESHOLDS } from '../scoring/config'
import type { ChampionRating } from '../scoring/rateTeam'
import { opponent, type ChampionRef, type MapSpot, type MatchEvent, type MatchResult, type MatchTeams } from './types'

/** Two casters: one screams at everything, the other is tired of this team. */
export type Caster = 'hype' | 'analyst'

export const CASTER_NAMES: Record<Caster, string> = { hype: 'Roary', analyst: 'Mortimer' }

export interface CommentaryLine {
  caster: Caster
  text: string
  /** True when the line roasts a pick or an item from the draft. */
  callback: boolean
}

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

export type LineKey =
  | 'firstBlood'
  | 'soloKill'
  | 'soloKillUpset'
  | 'gank'
  | 'counterGank'
  | 'gankEscape'
  | 'grubs'
  | 'herald'
  | 'dragon'
  | 'dragonSteal'
  | 'soul'
  | 'tower'
  | 'firstTower'
  | 'teamfight'
  | 'teamfightUpset'
  | 'ace'
  | 'pentakill'
  | 'baron'
  | 'baronSteal'
  | 'elder'
  | 'elderSteal'
  | 'inhibitor'
  | 'nexus'
  | 'surrender'

/** Every line, per event and caster. Exported so tests can check that each one fills in. */
export const MATCH_LINES: Record<LineKey, Record<Caster, Lines>> = {
  firstBlood: {
    hype: ({ actor, target, team }) => [
      `FIRST BLOOD! ${actor} takes down ${target} and the crowd goes wild!`,
      `AND THERE IT IS! First blood to ${actor}! ${target} is already typing in chat!`,
      `FIRST BLOOD for ${team}! The Rift has tasted blood and it wants more!`,
    ],
    analyst: ({ actor, target }) => [
      `First blood to ${actor}. ${target} will be explaining this in the post-game lobby.`,
      `${actor} gets first blood on ${target}. Nobody is surprised, least of all ${actor}.`,
      `First blood. ${target} walked forward without vision, which is a choice.`,
    ],
  },
  soloKill: {
    hype: ({ actor, target, lane }) => [
      `${actor} SOLO KILLS ${target} in ${lane}! What a play!`,
      `OUTPLAYED! ${actor} takes ${target} one on one!`,
      `${actor} just deleted ${target} in ${lane}! Somebody check on them!`,
      `${actor} wins the trade, the duel and the lane! ${target} is down!`,
    ],
    analyst: ({ actor, target, lane }) => [
      `${actor} kills ${target} in ${lane}. That matchup was not close.`,
      `${target} dies to ${actor}. The jungler will be blamed anyway.`,
      `Solo kill for ${actor}. ${target} pressed every button, just not in the right order.`,
      `${target} goes down to ${actor}. Respect the cooldowns, people.`,
      `${actor} takes ${target} one on one. ${target} has opened the replay and closed it again.`,
    ],
  },
  soloKillUpset: {
    hype: ({ actor, target }) => [
      `WHAT?! ${actor} beats ${target}! That should NOT have happened!`,
      `THE UNDERDOG BITES BACK! ${actor} takes down ${target}!`,
    ],
    analyst: ({ actor, target }) => [
      `${actor} beat ${target}. On paper that was impossible. Paper has been wrong before.`,
      `That's an upset. ${target} is watching the replay as we speak.`,
    ],
  },
  gank: {
    hype: ({ actor, target, team }) => [
      `GANK! ${team} collapses on ${target} and it's a kill for ${actor}!`,
      `The jungler shows up and ${target} is DONE! ${actor} gets the kill!`,
      `Out of the fog! ${target} never saw it coming! Kill for ${actor}!`,
    ],
    analyst: ({ actor, target, lane }) => [
      `The jungler shows up in ${lane}. ${target} did not ward. Nobody is surprised.`,
      `Textbook gank. ${target} is pinging the map now, a little late.`,
      `${actor} gets the kill on ${target}. Two against one tends to work.`,
      `${target} was pushing with no wards and no plan. ${actor} found both problems.`,
    ],
  },
  counterGank: {
    hype: ({ actor, target }) => [
      `COUNTER! ${actor} turns the gank around and kills ${target}!`,
      `${target} came for a kill and LEFT IN A BOX! ${actor} with the outplay!`,
    ],
    analyst: ({ actor, target, lane }) => [
      `${target} tried to gank ${lane}. ${actor} disagreed.`,
      `A gank that ends with the jungler dead. Bold strategy from ${target}.`,
    ],
  },
  gankEscape: {
    hype: ({ actor, target }) => [
      `FLASH! ${actor} dodges the gank by a pixel!`,
      `${actor} escapes with a sliver of health! ${target} leaves empty-handed!`,
    ],
    analyst: ({ actor, target, lane }) => [
      `${target} ganks ${lane}, burns everything, gets nothing. Efficient.`,
      `${actor} walks away from ${target}'s gank. That's a wasted trip through the river.`,
    ],
  },
  grubs: {
    hype: ({ team }) => [
      `${team} takes the Void Grubs! Those towers are getting NERVOUS!`,
      `Grubs to ${team}! Little bugs, BIG problems!`,
    ],
    analyst: ({ team, enemy }) => [
      `Void Grubs to ${team}. Small bugs, big tower damage.`,
      `${team} secures the grubs. Someone on ${enemy} forgot they existed.`,
    ],
  },
  herald: {
    hype: ({ team }) => [`${team} grabs the Rift Herald and they are CHARGING a tower!`],
    analyst: ({ team }) => [
      `Rift Herald to ${team}. A crab with a battering ram. The tower plates are crying.`,
      `${team} takes Herald. The nearest tower has about ten seconds left to live.`,
    ],
  },
  dragon: {
    hype: ({ team, dragon }) => [
      `${team} secures the ${dragon} Drake!`,
      `${dragon} Drake down! ${team} is stacking up!`,
      `The ${dragon} Drake falls! Another stack for ${team}!`,
    ],
    analyst: ({ team, enemy, dragon }) => [
      `${dragon} Drake to ${team}. ${enemy} decided it wasn't worth it. It was.`,
      `${team} takes the ${dragon} Drake while ${enemy} was looking elsewhere.`,
      `${team} takes the ${dragon} Drake. ${enemy} has agreed to let them, by not showing up.`,
    ],
  },
  dragonSteal: {
    hype: ({ actor, enemy, dragon }) => [
      `STOLEN! ${actor} SMITES the ${dragon} Drake away from ${enemy}!`,
      `NO WAY! ${actor} steals the dragon! ${enemy} did all the work!`,
    ],
    analyst: ({ actor, enemy }) => [
      `${enemy} did all the work, ${actor} pressed Smite. That's how dragons work now.`,
      `${actor} steals the dragon. ${enemy}'s jungler is reconsidering their career.`,
    ],
  },
  soul: {
    hype: ({ team, dragon }) => [
      `DRAGON SOUL! ${team} has the ${dragon} Soul and the Elder Dragon is coming!`,
      `That's FOUR dragons! ${team} claims the ${dragon} Soul!`,
    ],
    analyst: ({ team, enemy }) => [
      `Four dragons and a soul for ${team}. ${enemy} may want to look at the dragon pit sometime.`,
    ],
  },
  tower: {
    hype: ({ team, lane }) => [
      `Tower down in ${lane}! ${team} is pushing in!`,
      `${team} cracks open the ${lane} tower!`,
      `CRUMBLE! Another ${lane} tower falls to ${team}!`,
    ],
    analyst: ({ team, enemy, lane }) => [
      `${team} takes a tower in ${lane}. The map gets a little bigger for them.`,
      `Another tower for ${team}. ${enemy} is running out of turrets.`,
      `The ${lane} tower is down. ${enemy} was not there, which is a recurring theme.`,
      `${team} takes the ${lane} tower. Nobody on ${enemy} wanted to defend it, apparently.`,
    ],
  },
  firstTower: {
    hype: ({ team, lane }) => [`FIRST TOWER! ${team} takes the first turret in ${lane}!`],
    analyst: ({ team, enemy }) => [
      `First tower of the game to ${team}. Worth some gold and a lot of bragging.`,
      `${team} takes first tower. ${enemy} now has one less thing to hide behind.`,
    ],
  },
  teamfight: {
    hype: ({ team, actor, kills }) => [
      `TEAMFIGHT! ${team} wins it ${kills}! ${actor} leading the charge!`,
      `What a fight! ${team} comes out on top ${kills}!`,
      `Spells everywhere! When the dust settles, ${team} wins it ${kills}!`,
      `${actor} dives in and ${team} cleans up! ${kills}!`,
    ],
    analyst: ({ team, enemy, actor, kills }) => [
      `${team} wins the fight ${kills}. ${actor} did the heavy lifting.`,
      `${kills} for ${team}. ${enemy} engaged on a plan that was mostly hope.`,
      `${team} takes the fight ${kills}. ${enemy} forgot that fights need a frontline and a backline.`,
      `A ${kills} fight for ${team}. ${actor} was everywhere. ${enemy} was mostly in the fountain.`,
      `${team} wins it ${kills}. ${enemy} pinged "on my way" and meant it, sadly.`,
    ],
  },
  teamfightUpset: {
    hype: ({ team, kills }) => [
      `THE UNDERDOGS WIN THE FIGHT! ${team} takes it ${kills}!`,
      `HOW DID THEY WIN THAT?! ${team} goes ${kills}!`,
    ],
    analyst: ({ team, kills }) => [
      `${team} wins a fight they had no business winning. ${kills}. I'm rewriting my notes.`,
    ],
  },
  ace: {
    hype: ({ team, enemy, actor }) => [
      `ACE! ACE! ${team} wipes out all five! ${actor} is UNSTOPPABLE!`,
      `IT'S AN ACE! ${enemy} is all grey screens!`,
    ],
    analyst: ({ enemy }) => [
      `That's an ace, and judging by the items, it was deserved.`,
      `All five of ${enemy} are dead. Good time to read a book during the death timer.`,
    ],
  },
  pentakill: {
    hype: ({ actor }) => [
      `PENTAKILL! PENTAKILL! ${actor} KILLS ALL FIVE! I CAN'T BELIEVE IT!`,
      `${actor} GETS THE PENTA! SOMEBODY CLIP THAT!`,
    ],
    analyst: ({ actor }) => [`${actor} kills all five. I've run out of dry remarks. That was good.`],
  },
  baron: {
    hype: ({ team }) => [`BARON NASHOR goes down! ${team} has the purple buff!`, `${team} takes BARON! Here comes the push!`],
    analyst: ({ team, enemy }) => [
      `Baron to ${team}. ${enemy} is now defending their base, emotionally and literally.`,
      `${team} takes Baron. ${enemy} was busy doing something less important. Everything is less important.`,
    ],
  },
  baronSteal: {
    hype: ({ actor, enemy }) => [
      `THE SMITE! ${actor} STEALS BARON! I NEED TO SIT DOWN!`,
      `BARON STOLEN! ${actor} out of nowhere! ${enemy} is in shock!`,
    ],
    analyst: ({ actor, enemy }) => [`${enemy} spent a minute on Baron. ${actor} spent one Smite. Efficient.`],
  },
  elder: {
    hype: ({ team }) => [`ELDER DRAGON to ${team}! Anyone they touch is getting EXECUTED!`],
    analyst: ({ team }) => [`Elder Dragon to ${team}. Health bars are now more of a suggestion.`],
  },
  elderSteal: {
    hype: ({ actor }) => [`${actor} STEALS THE ELDER DRAGON! THIS GAME IS NOT OVER!`],
    analyst: ({ actor }) => [`${actor} steals Elder. I had already written the recap. Deleting it.`],
  },
  inhibitor: {
    hype: ({ team }) => [`INHIBITOR DOWN! Super minions incoming for ${team}!`],
    analyst: ({ team, enemy }) => [
      `${team} takes an inhibitor. ${enemy}'s base is starting to look like an open house.`,
      `Inhibitor down. ${enemy} now has super minions to worry about, on top of everything else.`,
    ],
  },
  nexus: {
    hype: ({ team }) => [`THE NEXUS FALLS! ${team} WINS IT!`, `GG! ${team} destroys the Nexus!`],
    analyst: ({ team, enemy }) => [
      `And that's the Nexus. ${team} wins. ${enemy} will be in the replay for a while.`,
      `GG. ${team} takes it. ${enemy} can start blaming each other now.`,
    ],
  },
  surrender: {
    hype: ({ team, enemy, time }) => [`${enemy} SURRENDERS! ${team} wins at ${time}!`],
    analyst: ({ enemy, time }) => [
      `And ${enemy} surrenders at ${time}. A wise decision, honestly.`,
      `${enemy} votes to surrender. Their first good team decision all game.`,
    ],
  },
}

/** Analyst lines that remember the draft. */
export const CALLBACK_LINES = {
  offRoleWins: (name: string, role: string) => [
    `${name} ${role}. I said it was a terrible pick. I stand by that. Even now.`,
    `${name} playing ${role} and winning. Tier lists in shambles.`,
  ],
  offRoleDies: (name: string, role: string) => [
    `${name} ${role}. Some things are just inevitable.`,
    `And that is why ${name} does not usually play ${role}.`,
  ],
  badItemWins: (name: string, item: string) => [
    `${name} did that with ${item}. Imagine with a real build.`,
    `${item} on ${name}, and it still worked. Don't tell the theorycrafters.`,
  ],
  badItemDies: (name: string, item: string) => [
    `That ${item} on ${name} did exactly what we expected: nothing.`,
    `${name} with ${item}. The build was the first mistake. This was the second.`,
  ],
} as const

/** A share of eligible kills that get a draft callback instead of the normal line. */
const CALLBACK_CHANCE = 0.45
/** Big moments go to the hype caster this often, small ones to the analyst. */
const HYPE_ON_BIG = 0.75
const ANALYST_ON_SMALL = 0.6

const LANE_NAMES: Partial<Record<MapSpot, string>> = { top: 'top lane', mid: 'mid lane', bot: 'bot lane' }

/** The player's team is called "Your team", which reads as "your team" mid-sentence. */
export const lowercaseYourMidSentence = (text: string): string => text.replace(/([^.!?]) Your team/g, '$1 your team')

/** "27:05". */
export function formatGameTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

export function lineKey({ kind, tags }: MatchEvent): LineKey {
  const has = (tag: MatchEvent['tags'][number]) => tags.includes(tag)
  switch (kind) {
    case 'soloKill':
      return has('firstBlood') ? 'firstBlood' : has('upset') ? 'soloKillUpset' : 'soloKill'
    case 'gank':
      if (has('escape')) return 'gankEscape'
      if (has('counterGank')) return 'counterGank'
      return has('firstBlood') ? 'firstBlood' : 'gank'
    case 'teamfight':
      if (has('pentakill')) return 'pentakill'
      if (has('ace')) return 'ace'
      return has('upset') ? 'teamfightUpset' : 'teamfight'
    case 'dragon':
      return has('steal') ? 'dragonSteal' : has('soul') ? 'soul' : 'dragon'
    case 'baron':
      return has('steal') ? 'baronSteal' : 'baron'
    case 'elder':
      return has('steal') ? 'elderSteal' : 'elder'
    case 'tower':
      return has('firstTower') ? 'firstTower' : 'tower'
    default:
      return kind
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
 * One line per event, picked with its own seeded random so changing a line never changes
 * how a match plays out. Lines aren't repeated while there are unused variants.
 */
export function commentate(match: MatchResult, teams: MatchTeams): CommentaryLine[] {
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

  const callback = (event: MatchEvent): CommentaryLine | null => {
    if (!KILL_KINDS.includes(event.kind) || event.tags.includes('escape') || random() >= CALLBACK_CHANCE) return null
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
    const roast = callback(event)
    if (roast) return roast

    const caster: Caster = event.big
      ? random() < HYPE_ON_BIG
        ? 'hype'
        : 'analyst'
      : random() < ANALYST_ON_SMALL
        ? 'analyst'
        : 'hype'
    const context = lineContext(event, teams)
    const text = lowercaseYourMidSentence(pick(MATCH_LINES[lineKey(event)][caster](context)))
    return { caster, text, callback: false }
  })
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

