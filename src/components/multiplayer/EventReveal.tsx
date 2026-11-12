import { motion } from 'framer-motion'
import type { LiveEventKind, Side } from '../../game/match/types'
import type { EventResult } from '../../game/multiplayer/protocol'
import { BUSH_NAMES } from '../../game/multiplayer/liveEvents'

interface EventRevealProps {
  kind: LiveEventKind
  result: EventResult
  /** Your side in the simulation (blue is the host). */
  mySide: Side
  opponentName: string
}

const WIN_TEXT: Record<LiveEventKind, { won: string; lost: string }> = {
  gank: { won: 'You win the fight in lane!', lost: 'They win the fight in lane.' },
  teamfight: { won: 'Your ult wins the teamfight!', lost: 'Their ult wins the teamfight.' },
  baron: { won: 'Baron is yours!', lost: 'They take Baron.' },
  elder: { won: 'Elder Dragon is yours!', lost: 'They take Elder Dragon.' },
}

/** Who won the mini-game, with both scores (or the bush and the guess), before the match goes on. */
export function EventReveal({ kind, result, mySide, opponentName }: EventRevealProps) {
  const won = result.winner === mySide
  const theirSide: Side = mySide === 'blue' ? 'red' : 'blue'

  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 14 }}
      className="flex flex-col items-center gap-3 text-center"
    >
      {result.scores ? (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <Score label="You" value={result.scores[mySide]} winner={won} className="text-hextech" />
          <span className="font-display text-xl text-gold/60">vs</span>
          <Score label={opponentName} value={result.scores[theirSide]} winner={!won} className="text-red-400" />
        </div>
      ) : (
        result.bush && (
          <p className="text-gold-light/80">
            The jungler hid in <strong className="text-gold">{BUSH_NAMES[result.bush]}</strong>.{' '}
            {result.guess ? (
              <>
                The guess was <strong className="text-gold">{BUSH_NAMES[result.guess]}</strong>.
              </>
            ) : (
              'Nobody guessed in time.'
            )}
          </p>
        )
      )}
      {result.scores && result.scores.blue === result.scores.red && (
        <p className="text-sm text-gold-light/60">A tie! A coin flip decides it.</p>
      )}
      <p className={`font-display text-3xl font-black ${won ? 'text-gold' : 'text-red-400'}`}>
        {won ? WIN_TEXT[kind].won : WIN_TEXT[kind].lost}
      </p>
    </motion.div>
  )
}

function Score({ label, value, winner, className }: { label: string; value: number; winner: boolean; className: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <span className={`max-w-40 leading-tight [overflow-wrap:anywhere] text-xs font-semibold tracking-wider uppercase ${className}`}>{label}</span>
      <span className={`font-display text-5xl font-black ${winner ? 'text-gold' : 'text-gold-light/50'}`}>{value}</span>
    </div>
  )
}
