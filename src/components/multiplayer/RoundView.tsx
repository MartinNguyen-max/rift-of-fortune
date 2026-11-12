import { useMemo, useState } from 'react'
import { gameData } from '../../data'
import { roundTeams, teamsFor } from '../../game/multiplayer/roundTeams'
import { sideOf, TIMINGS, type RoundState } from '../../game/multiplayer/session'
import { DraftStage } from './DraftStage'
import { LiveMatchView } from './LiveMatchView'
import type { Room } from './useRoom'
import { VersusScreen } from './VersusScreen'

/** One game in a lobby: draft, versus screen, then the live match. */
export function RoundView({ room, round }: { room: Room; round: RoundState }) {
  const [versusDone, setVersusDone] = useState(false)
  const match = round.match
  const players = round.players
  const teams = useMemo(() => roundTeams({ players, match }, gameData), [players, match])
  const mySide = sideOf(round, room.me.id)

  if (!match || !teams) return <DraftStage room={room} round={round} />
  if (!versusDone) {
    return (
      <VersusScreen
        teams={teamsFor(teams, mySide)}
        deadline={match.startedAt + TIMINGS.versus * 1000}
        onDone={() => setVersusDone(true)}
      />
    )
  }
  return <LiveMatchView room={room} round={round} teams={teams} />
}
