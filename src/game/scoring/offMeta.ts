import type { Role } from '../../data/types'

/**
 * Off-role picks that really show up in ranked games, written from game knowledge, for the ones
 * the play-rate data and the League of Legends Wiki (see scripts/) do not list yet. Without this
 * they would count as a disaster when they are just unusual (ROLE_FIT_SCORE.offMeta).
 */
export const OFF_META_ROLES: Record<string, readonly Role[]> = {
  Briar: ['BOTTOM', 'TOP'],
  Cassiopeia: ['TOP'],
  Chogath: ['MIDDLE'],
  Garen: ['MIDDLE'],
  Graves: ['TOP'],
  Heimerdinger: ['BOTTOM'],
  Karthus: ['BOTTOM', 'MIDDLE'],
  Kayle: ['MIDDLE'],
  Lillia: ['TOP'],
  Poppy: ['SUPPORT'],
  Sett: ['SUPPORT'],
  Sylas: ['JUNGLE'],
  Zyra: ['JUNGLE'],
}
