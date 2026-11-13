import { hpAt, NO_SMITE, SMITE_DAMAGE, type SmiteFight, type SmiteResult, type SmiteTarget } from '../../game/minigames/smite'

export const TARGET_NAMES: Record<SmiteTarget, string> = { baron: 'Baron Nashor', elder: 'Elder Dragon' }

export const formatHp = (hp: number): string => Math.round(hp).toLocaleString('en-US')

/** The health a smite move froze the bar at: 0 if the objective died first. */
export function hpOfSmite(fight: SmiteFight, move: number): number {
  const seconds = move / 1000
  return move >= NO_SMITE || seconds >= fight.deathAt ? 0 : hpAt(fight, seconds)
}

/** How many hits have landed by `seconds`, and how much the latest one took. */
export function hitsBy(fight: SmiteFight, seconds: number): { count: number; lastDamage: number } {
  const count = fight.hits.filter(({ at }) => at <= seconds).length
  const after = fight.hits[count - 1]?.hp
  const before = count >= 2 ? fight.hits[count - 2]?.hp : fight.startHp
  return { count, lastDamage: after === undefined || before === undefined ? 0 : before - after }
}

/** A short note for a smite: how fast it was after the line, or why it didn't kill. */
export function smiteNote(result: SmiteResult): string {
  if (result.outcome === 'early') return `TOO EARLY · ${formatHp(result.hp)} HP`
  if (result.outcome === 'late') return 'TOO LATE'
  return `${result.reaction ?? 0} ms`
}

/** The line under a smite that didn't kill: what went wrong. */
export function missedReason(result: SmiteResult): string {
  return result.outcome === 'early'
    ? `It had ${formatHp(result.hp)} HP. Smite deals ${formatHp(SMITE_DAMAGE)}.`
    : 'The teams killed it first.'
}
