import { motion } from 'framer-motion'
import { useEffect, useMemo } from 'react'
import type { MatchTeams, Side } from '../../game/match/types'
import { teamsFor } from '../../game/multiplayer/roundTeams'
import { playerOn, sideOf, type RoundState } from '../../game/multiplayer/session'
import { teamFightWinner } from '../../game/multiplayer/teamFight'
import { MatchSounds } from '../match/MatchSounds'
import { routeHref } from '../useHashRoute'
import { EmoteBar } from './Emotes'
import { RematchControls, ResultHeading } from './LiveEndPanel'
import { SeriesScore } from './SeriesScore'
import type { Room } from './useRoom'
import { VersusBoards } from './VersusScreen'

interface TeamFightViewProps {
  room: Room
  round: RoundState
  /** Host on blue. */
  teams: MatchTeams
}

const otherSide = (side: Side): Side => (side === 'blue' ? 'red' : 'blue')

/**
 * A draft battle without live events: no match is played. The higher team rating wins (a coin
 * flip on a tie), shown above both teams with the series, Rematch and emotes.
 */
export function TeamFightView({ room, round, teams }: TeamFightViewProps) {
  const { me, wins, sendEmote, finishRound } = room
  const mySide = sideOf(round, me.id)
  const theirSide = otherSide(mySide)
  const viewTeams = useMemo(() => teamsFor(teams, mySide), [teams, mySide])
  const ratings = { blue: teams.blue.rating.score, red: teams.red.rating.score }
  const fight = teamFightWinner(ratings, round.match?.seed ?? 0)
  const winnerSide = round.surrendered ? otherSide(sideOf(round, round.surrendered)) : fight.winner
  const winnerId = playerOn(round, winnerSide)?.id
  const won = winnerSide === mySide
  const opponentInfo = round.players.find(({ id }) => id !== me.id)
  const opponentName = opponentInfo?.name ?? 'Your opponent'

  useEffect(() => {
    if (winnerId) finishRound(round.id, winnerId)
  }, [winnerId, finishRound, round.id])

  const note = round.surrendered
    ? round.surrendered === me.id
      ? 'You surrendered.'
      : `${opponentName} surrendered.`
    : fight.coinFlip
      ? 'Same team rating: a coin flip decided it.'
      : 'The higher team rating wins.'

  return (
    <section className="flex w-full max-w-5xl flex-col items-center gap-4">
      <MatchSounds fightIndex={null} ended won={won} />
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14 }}
        className="flex w-full max-w-md flex-col gap-4 rounded-xl border-2 border-gold/50 bg-panel/90 p-4 text-center shadow-2xl shadow-black/60"
      >
        <ResultHeading won={won} note={note} />
        <RatingLine mine={ratings[mySide]} theirs={ratings[theirSide]} />
        {opponentInfo && <SeriesScore me={me} opponent={opponentInfo} wins={wins} />}
        <RematchControls room={room} round={round} />
        <EmoteBar onEmote={sendEmote} />
        <a href={routeHref('play')} className="text-sm text-hextech underline-offset-4 hover:underline">
          Leave lobby
        </a>
      </motion.div>
      <VersusBoards teams={viewTeams} />
    </section>
  )
}

/** Both team ratings: yours (teal) and theirs (red). */
function RatingLine({ mine, theirs }: { mine: number; theirs: number }) {
  return (
    <p className="flex items-center justify-center gap-3 rounded-lg border border-hextech/30 bg-hextech/5 px-3 py-2">
      <span className="text-[10px] tracking-widest text-gold-light/60 uppercase">Team rating</span>
      <span className="font-mono text-xl font-bold">
        <span className="text-hextech">{mine}</span>
        <span className="text-gold-light/40"> – </span>
        <span className="text-red-400">{theirs}</span>
      </span>
    </p>
  )
}
