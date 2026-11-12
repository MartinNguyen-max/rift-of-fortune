import type { Champion, Item } from '../../data/types'
import type { MatchTeams, Side } from '../match/types'
import { seededRandom } from '../random'
import { rateTeam } from '../scoring/rateTeam'
import { completeTeam } from './completeTeam'
import type { RoundState } from './session'
import { decodeTeam } from './teamCode'

interface GameDataPools {
  champions: readonly Champion[]
  items: readonly Item[]
}

/**
 * Both teams as the simulation sees them: the host on blue. A team that can't be read (it never
 * should) becomes a random one from the match seed, so both players still get the same match.
 */
export function roundTeams(round: Pick<RoundState, 'players' | 'match'>, data: GameDataPools): MatchTeams | null {
  if (!round.match) return null
  const { seed, teams } = round.match
  const team = (side: Side) => {
    const index = side === 'blue' ? 0 : 1
    const encoded = teams[index]
    const members =
      (encoded && decodeTeam(encoded, data)) ?? completeTeam(null, data, seededRandom(seed + index + 1))
    return { name: round.players[index]?.name ?? 'Team ?', rating: rateTeam(members) }
  }
  return { blue: team('blue'), red: team('red') }
}

/** The same teams from one player's point of view: their own team on blue. */
export function teamsFor(teams: MatchTeams, side: Side): MatchTeams {
  return side === 'blue' ? teams : { blue: teams.red, red: teams.blue }
}
