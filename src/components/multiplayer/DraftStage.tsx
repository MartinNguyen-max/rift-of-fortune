import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gameData } from '../../data'
import type { GameState } from '../../game/gameState'
import { completeTeam } from '../../game/multiplayer/completeTeam'
import type { RoundState } from '../../game/multiplayer/session'
import { draftRules } from '../../game/multiplayer/settings'
import { encodeTeam } from '../../game/multiplayer/teamCode'
import type { TeamRating } from '../../game/scoring/rateTeam'
import type { TeamMember } from '../../game/scoring/teamBalance'
import { Button } from '../Button'
import { Game } from '../Game'
import { nextChampion, randomItems, rerollChampion, rerollItem } from '../matchDraft'
import { useCountdown } from '../useCountdown'
import type { Room } from './useRoom'

/** The last seconds of the draft timer turn red. */
const HURRY_SECONDS = 15

const membersOf = (rating: TeamRating): TeamMember[] =>
  rating.champions.map(({ role, champion, items }) => ({ role, champion, items: items.map(({ item }) => item) }))

/**
 * Both players draft at the same time with the lobby's rules (rerolls). Pressing Ready
 * locks the team in; when the timer runs out, whatever is missing is filled in at random.
 */
export function DraftStage({ room, round }: { room: Room; round: RoundState }) {
  const { me, send } = room
  const [lockedIn, setLockedIn] = useState(false)
  const latest = useRef<GameState | null>(null)
  const remaining = useCountdown(round.startedAt + round.draftSeconds * 1000)
  const opponent = round.players.find(({ id }) => id !== me.id)
  const opponentLocked = opponent !== undefined && round.teams[opponent.id] !== undefined
  const timeUp = remaining <= 0
  const rules = useMemo(() => draftRules(round.settings), [round.settings])

  const lockIn = useCallback(
    (members: TeamMember[]) => {
      setLockedIn(true)
      send({ type: 'team', round: round.id, player: me.id, team: encodeTeam(members) })
    },
    [send, round.id, me.id],
  )

  useEffect(() => {
    if (timeUp && !lockedIn) lockIn(completeTeam(latest.current, gameData, Math.random))
  }, [timeUp, lockedIn, lockIn])

  const remember = useCallback((state: GameState) => {
    latest.current = state
  }, [])

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <DraftTimer remaining={remaining} total={round.draftSeconds} opponentLocked={opponentLocked} />
      <div className="relative w-full">
        <Game
          title="Multiplayer draft"
          nextChampion={nextChampion}
          drawItems={randomItems}
          rules={rules}
          rerollChampion={rules.championRerolls > 0 ? rerollChampion : undefined}
          rerollItem={rules.itemRerolls > 0 ? rerollItem : undefined}
          onStateChange={remember}
          resultActions={(rating) => (
            <Button onClick={() => lockIn(membersOf(rating))} disabled={lockedIn} className="text-lg">
              Ready
            </Button>
          )}
        />
        {lockedIn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-abyss/80 p-4 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="font-display text-3xl font-black text-gold">{timeUp ? "Time's up!" : 'Locked in'}</p>
              <p className="text-gold-light/80">
                {timeUp ? 'We finished your team for you. ' : ''}
                {opponentLocked ? 'Starting the match…' : `Waiting for ${opponent?.name ?? 'your opponent'}…`}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function DraftTimer({ remaining, total, opponentLocked }: { remaining: number; total: number; opponentLocked: boolean }) {
  const hurry = remaining <= HURRY_SECONDS
  return (
    <div className="w-full max-w-xl" role="timer" aria-label={`${Math.ceil(remaining)} seconds left to draft`}>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className={`font-mono text-lg font-bold tabular-nums ${hurry ? 'text-red-400' : 'text-gold-light'}`}>
          {Math.ceil(remaining)}s
        </span>
        <span className={opponentLocked ? 'font-semibold text-gold' : 'text-gold-light/60'}>
          {opponentLocked ? 'Opponent is ready ✓' : 'Opponent is drafting…'}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-abyss/80">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-linear ${hurry ? 'bg-red-400' : 'bg-gold'}`}
          style={{ width: `${(remaining / total) * 100}%` }}
        />
      </div>
    </div>
  )
}
