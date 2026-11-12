import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { BOT_PROFILES, type BotLevel } from '../../game/match/bots'
import { commentate } from '../../game/match/commentary'
import { eventsShown, liveScore, SPEEDS, startTime, type Speed } from '../../game/match/playback'
import { simulateMatch } from '../../game/match/simulateMatch'
import { summarizeMatch } from '../../game/match/summary'
import type { MatchTeams } from '../../game/match/types'
import { EventFeed } from './EventFeed'
import { GoldGraph } from './GoldGraph'
import { MatchEndPanel } from './MatchEndPanel'
import { MatchMap } from './MatchMap'
import { MatchScoreboard } from './MatchScoreboard'
import { useMatchClock } from './useMatchClock'
import { VersusPanel } from './VersusPanel'

interface MatchViewProps {
  teams: MatchTeams
  level: BotLevel
  seed: number
  onRematch: (level: BotLevel) => void
  onNewTeam: () => void
}

/** Versus screen, then the match played back live, then the result. */
export function MatchView({ teams, level, seed, onRematch, onNewTeam }: MatchViewProps) {
  const match = useMemo(() => simulateMatch(teams, seed), [teams, seed])
  const lines = useMemo(() => commentate(match, teams), [match, teams])
  const [started, setStarted] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const { clock, skip } = useMatchClock(startTime(match.events), match.duration, speed, started)

  if (!started) return <VersusPanel teams={teams} botLabel={BOT_PROFILES[level].label} onStart={() => setStarted(true)} />

  const shown = eventsShown(match.events, clock)
  const ended = shown === match.events.length
  const score = liveScore(match.events, clock)
  const shownEvents = match.events.slice(0, shown)
  const lastBig = shownEvents.findLastIndex(({ big }) => big)

  return (
    <div className="flex w-full max-w-5xl flex-col gap-3 lg:flex-row lg:items-start lg:gap-6">
      <div className="flex w-full flex-col gap-3 lg:sticky lg:top-4 lg:w-96 lg:shrink-0">
        <motion.div key={lastBig} animate={lastBig >= 0 ? { x: [0, -6, 6, -4, 4, 0] } : undefined} transition={{ duration: 0.4 }}>
          <MatchScoreboard teams={teams} score={score} clock={clock} />
        </motion.div>
        {!ended && <PlaybackControls speed={speed} onSpeed={setSpeed} onSkip={skip} />}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <MatchMap events={shownEvents} />
          <GoldGraph events={shownEvents} clock={clock} currentDiff={score.blue.gold - score.red.gold} />
        </div>
      </div>

      <div className="flex w-full flex-col gap-3 lg:flex-1">
        {ended && (
          <MatchEndPanel
            match={match}
            teams={teams}
            lines={lines}
            summary={summarizeMatch(match, lines)}
            level={level}
            onRematch={onRematch}
            onNewTeam={onNewTeam}
          />
        )}
        <EventFeed events={match.events} lines={lines} shown={shown} />
      </div>
    </div>
  )
}

interface PlaybackControlsProps {
  speed: Speed
  onSpeed: (speed: Speed) => void
  onSkip: () => void
}

function PlaybackControls({ speed, onSpeed, onSkip }: PlaybackControlsProps) {
  const base = 'rounded-md border px-3 py-1 text-sm font-semibold transition'
  return (
    <div className="flex items-center justify-center gap-2" role="group" aria-label="Playback speed">
      {SPEEDS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={speed === option}
          onClick={() => onSpeed(option)}
          className={`${base} ${speed === option ? 'border-gold bg-gold/20 text-gold-light' : 'border-gold/30 text-gold-light/60 hover:border-gold'}`}
        >
          {option}×
        </button>
      ))}
      <button type="button" onClick={onSkip} className={`${base} border-gold/30 text-gold-light/60 hover:border-gold`}>
        Skip ⏭
      </button>
    </div>
  )
}
