import type { Champion, Role } from '../../data/types'
import { ROLE_CLASSES, ROLE_FIT_SCORE } from './config'

export type RoleFitKind = keyof typeof ROLE_FIT_SCORE

export interface RoleFit {
  kind: RoleFitKind
  score: number
}

export function scoreRoleFit(champion: Champion, role: Role): RoleFit {
  const kind: RoleFitKind = champion.positions.includes(role)
    ? 'onRole'
    : champion.classes.some((championClass) => ROLE_CLASSES[role].includes(championClass))
      ? 'classFit'
      : 'offRole'
  return { kind, score: ROLE_FIT_SCORE[kind] }
}
