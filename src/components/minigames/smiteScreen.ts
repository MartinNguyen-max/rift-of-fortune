import { hpAt, NO_SMITE, type SmiteDuel, type SmiteResult, type SmiteTarget } from '../../game/minigames/smite'

export const TARGET_NAMES: Record<SmiteTarget, string> = { baron: 'Baron Nashor', elder: 'Elder Dragon' }

export const formatHp = (hp: number): string => Math.round(hp).toLocaleString('en-US')

/** The health (0–1) a smite move froze the bar at: 0 if the objective died first. */
export function hpOfSmite(duel: SmiteDuel, move: number): number {
  const seconds = move / 1000
  return move >= NO_SMITE || seconds >= duel.deathAt ? 0 : hpAt(duel, seconds)
}

/** A short note under a smite's score: the health it landed on, or why it scored 0. */
export function smiteNote(result: SmiteResult): string {
  if (result.outcome === 'early') return 'TOO EARLY'
  if (result.outcome === 'late') return 'TOO LATE'
  return `${formatHp(result.hp)} HP`
}
