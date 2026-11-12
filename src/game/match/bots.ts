import type { Champion, Item } from '../../data/types'
import { pickRandom, type RandomFn } from '../random'
import { rateTeam, type TeamRating } from '../scoring/rateTeam'
import { simulateGame, type Strategy } from '../scoring/simulate'
import type { MatchTeam } from './types'

export const BOT_LEVELS = [1, 2, 3] as const
export type BotLevel = (typeof BOT_LEVELS)[number]

interface BotProfile {
  label: string
  description: string
  strategy: Strategy
  /** The bot drafts this many teams and keeps the best one. */
  drafts: number
  names: readonly string[]
}

/**
 * Bots draft with the same rules as the player, using the strategies from the rank calibration:
 * level 1 places everything at random (usually Iron or Bronze), level 2 plays sensibly
 * (usually Gold or Platinum), and level 3 keeps the best of several sensible drafts.
 */
export const BOT_PROFILES: Record<BotLevel, BotProfile> = {
  1: {
    label: 'Level 1',
    description: 'Drafts at random. Has never seen a tier list.',
    strategy: 'random',
    drafts: 1,
    names: ['Team Afk Farm', 'Team Ward What Ward', 'Team Smite Optional', 'Team Bronze Ambition', 'Team Tutorial Graduates'],
  },
  2: {
    label: 'Level 2',
    description: 'Puts champions where they belong. Mostly.',
    strategy: 'sensible',
    drafts: 1,
    names: ['Team Gold Standard', 'Team Hardstuck Plat', 'Team Mid Diff', 'Team Solo Queue Heroes', 'Team Tilt Proof'],
  },
  3: {
    label: 'Level 3',
    description: 'The final boss. Best of four drafts, no mercy.',
    strategy: 'sensible',
    drafts: 4,
    names: ['Team JungleDiff', 'Team Challenger Smurfs', 'Team Final Boss', 'Team Worlds Qualifier', 'Team Perfect Draft'],
  },
}

export const isBotLevel = (value: unknown): value is BotLevel =>
  typeof value === 'number' && (BOT_LEVELS as readonly number[]).includes(value)

/**
 * Drafts a bot team. Champions already on the player's team are left out,
 * since a champion can't be on both sides of the Rift.
 */
export function createBotTeam(
  data: { champions: readonly Champion[]; items: readonly Item[] },
  level: BotLevel,
  takenChampionIds: readonly string[],
  random: RandomFn,
): MatchTeam {
  const profile = BOT_PROFILES[level]
  const taken = new Set(takenChampionIds)
  const pool = { champions: data.champions.filter(({ id }) => !taken.has(id)), items: data.items }

  let best: TeamRating | null = null
  for (let draft = 0; draft < profile.drafts; draft++) {
    const rating = rateTeam(simulateGame(pool, profile.strategy, random))
    if (!best || rating.score > best.score) best = rating
  }
  if (!best) throw new Error('A bot needs at least one draft')
  return { name: pickRandom(profile.names, random), rating: best }
}
