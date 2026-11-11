import type { Champion, Role } from '../../data/types'
import { LANE_SWAP_SCORE, ROLE_CLASSES, ROLE_FIT_BANDS, ROLE_FIT_SCORE } from './config'

/**
 * - `mainRole` / `secondaryRole`: the champion is played in this role.
 * - `closeFit`: off-role, but a swap that can work (e.g. a mid laner in top).
 * - `stretch`: off-role and awkward (e.g. a top laner on support).
 * - `offRole`: a disaster (e.g. a support in the jungle).
 */
export type RoleFitKind = 'mainRole' | 'secondaryRole' | 'closeFit' | 'stretch' | 'offRole'

export interface RoleFit {
  kind: RoleFitKind
  score: number
  /** The champion's main role, so feedback can say where they came from. */
  usualRole: Role | null
}

export const isOnRole = ({ kind }: RoleFit): boolean => kind === 'mainRole' || kind === 'secondaryRole'

function offRoleKind(score: number): RoleFitKind {
  if (score >= ROLE_FIT_BANDS.closeFit) return 'closeFit'
  if (score >= ROLE_FIT_BANDS.stretch) return 'stretch'
  return 'offRole'
}

export function scoreRoleFit(champion: Champion, role: Role): RoleFit {
  const [usualRole = null] = champion.positions
  if (usualRole === role) return { kind: 'mainRole', score: ROLE_FIT_SCORE.mainRole, usualRole }
  if (champion.positions.includes(role)) return { kind: 'secondaryRole', score: ROLE_FIT_SCORE.secondaryRole, usualRole }

  // The best swap from any of the champion's roles, with the class fit as a minimum.
  const swap = Math.max(0, ...champion.positions.map((position) => LANE_SWAP_SCORE[position][role]))
  const classFits = champion.classes.some((championClass) => ROLE_CLASSES[role].includes(championClass))
  const score = Math.max(swap, classFits ? ROLE_FIT_SCORE.classFit : 0)
  return { kind: offRoleKind(score), score, usualRole }
}
