import type { Role } from '../../data/types'

/**
 * Off-role picks that really show up in ranked games, written from game knowledge: the play-rate
 * data only lists each champion's main roles, so it calls these a disaster when they are just
 * unusual. They score as a reasonable swap instead (ROLE_FIT_SCORE.offMeta).
 */
export const OFF_META_ROLES: Record<string, readonly Role[]> = {
  Ashe: ['SUPPORT'],
  Brand: ['JUNGLE'],
  Briar: ['BOTTOM', 'TOP'],
  Cassiopeia: ['TOP'],
  Chogath: ['MIDDLE'],
  Galio: ['SUPPORT'],
  Garen: ['MIDDLE'],
  Gragas: ['JUNGLE', 'MIDDLE'],
  Graves: ['TOP'],
  Heimerdinger: ['SUPPORT', 'BOTTOM'],
  Hwei: ['SUPPORT'],
  Karma: ['TOP', 'MIDDLE'],
  Karthus: ['BOTTOM', 'MIDDLE'],
  Kayle: ['MIDDLE'],
  Lillia: ['TOP'],
  Malphite: ['SUPPORT', 'MIDDLE'],
  Maokai: ['TOP', 'JUNGLE'],
  Neeko: ['MIDDLE'],
  Pantheon: ['TOP', 'MIDDLE', 'JUNGLE'],
  Poppy: ['SUPPORT'],
  Sett: ['SUPPORT'],
  Shaco: ['SUPPORT'],
  Smolder: ['MIDDLE', 'TOP'],
  Sylas: ['TOP', 'JUNGLE'],
  Taliyah: ['JUNGLE'],
  Teemo: ['SUPPORT', 'JUNGLE'],
  TwistedFate: ['BOTTOM'],
  Velkoz: ['MIDDLE'],
  Ziggs: ['MIDDLE'],
  Zyra: ['JUNGLE'],
}
