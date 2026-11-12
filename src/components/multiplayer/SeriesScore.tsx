import type { PlayerId, PlayerInfo } from '../../game/multiplayer/protocol'

interface SeriesScoreProps {
  me: PlayerInfo
  opponent: PlayerInfo
  wins: Partial<Record<PlayerId, number>>
}

/** "You 2 – 1 Opponent" across rematches. Hidden before the first game is over. */
export function SeriesScore({ me, opponent, wins }: SeriesScoreProps) {
  const mine = wins[me.id] ?? 0
  const theirs = wins[opponent.id] ?? 0
  if (mine + theirs === 0) return null
  return (
    <p className="font-display text-sm font-bold tracking-wider text-gold-light uppercase">
      Series <span className="text-hextech">{mine}</span> – <span className="text-red-400">{theirs}</span>
    </p>
  )
}
