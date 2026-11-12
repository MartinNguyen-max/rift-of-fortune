import { ROLES } from '../roles'
import type { ChampionStats, MatchEvent, Side } from './types'

export function emptyStats(): ChampionStats {
  const forSide = () => Object.fromEntries(ROLES.map((role) => [role, { kills: 0, deaths: 0, assists: 0 }])) as ChampionStats[Side]
  return { blue: forSide(), red: forSide() }
}

/** Every champion's K/D/A after the first `count` events. */
export function statsAfter(events: readonly MatchEvent[], count = events.length): ChampionStats {
  const stats = emptyStats()
  for (const { kills } of events.slice(0, count)) {
    for (const { killer, victim, assists } of kills) {
      stats[killer.side][killer.role].kills += 1
      stats[victim.side][victim.role].deaths += 1
      for (const role of assists) stats[killer.side][role].assists += 1
    }
  }
  return stats
}
