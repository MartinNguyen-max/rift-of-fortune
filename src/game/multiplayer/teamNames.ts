import { pickRandom, type RandomFn } from '../random'

/** Every player gets one of these when they open a lobby. */
export const TEAM_NAMES = [
  'Team Flash on F',
  'Team Ghost Ward',
  'Team Int Squad',
  'Team Baron Throw',
  'Team Ping Spam',
  'Team Gank Bot Pls',
  'Team No Wards',
  'Team Ff15',
  'Team One More Game',
  'Team Ignite Top',
  'Team Missing Ping',
  'Team Kite Runners',
  'Team Solo Carry',
  'Team Report Jungle',
  'Team Minion Block',
  'Team Tower Dive',
  'Team Dragon Soul',
  'Team Last Hit',
  'Team Backdoor',
  'Team Wombo Combo',
] as const

/** A random team name, different from the opponent's when one is given. */
export function randomTeamName(random: RandomFn = Math.random, avoid?: string): string {
  return pickRandom(
    TEAM_NAMES.filter((name) => name !== avoid),
    random,
  )
}
