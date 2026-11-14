import { useMemo, useState } from 'react'
import { gameData } from '../../data'
import { roundTeams, teamsFor } from '../../game/multiplayer/roundTeams'
import { sideOf, TIMINGS, type RoundState } from '../../game/multiplayer/session'
import { DraftStage } from './DraftStage'
import { LanesView } from './LanesView'
import { LiveMatchView } from './LiveMatchView'
import type { Room } from './useRoom'
import { VersusScreen } from './VersusScreen'

/** One game in a lobby: draft, versus screen, then the live match; or the five lanes. */
export function RoundView({ room, round }: { room: Room; round: RoundState }) {
  const [versusDone, setVersusDone] = useState(false)
  const match = round.match
  const players = round.players
  const teams = useMemo(() => roundTeams({ players, match }, gameData), [players, match])
  const mySide = sideOf(round, room.me.id)

  if (round.settings.mode === 'lanes') return match ? <LanesView room={room} round={round} /> : <RollingTeams />
  if (!match || !teams) return <DraftStage room={room} round={round} />
  if (!versusDone && !round.surrendered) {
    return (
      <VersusScreen
        teams={teamsFor(teams, mySide)}
        deadline={match.startedAt + TIMINGS.versus * 1000}
        onDone={() => setVersusDone(true)}
        onSurrender={() => room.send({ type: 'surrender', round: round.id, player: room.me.id })}
      />
    )
  }
  return <LiveMatchView room={room} round={round} teams={teams} />
}

/** Five lanes: the host is rolling both random teams (a moment). */
function RollingTeams() {
  return (
    <p className="font-display text-2xl font-black text-gold" role="status">
      Rolling random teams…
    </p>
  )
}
