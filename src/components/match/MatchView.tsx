import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { BOT_PROFILES, type BotLevel } from '../../game/match/bots'
import { commentate } from '../../game/match/commentary'
import { activeBigEvent, buildTimeline, eventsShown, gameClock, liveScore } from '../../game/match/playback'
import { simulateMatch } from '../../game/match/simulateMatch'
import { statsAfter } from '../../game/match/stats'
import { summarizeMatch } from '../../game/match/summary'
import type { MatchTeams } from '../../game/match/types'
import { winChanceTimeline } from '../../game/match/winChance'
import { ChampionScoreboard } from './ChampionScoreboard'
import { EventFeed } from './EventFeed'
import { FightScene } from './FightScene'
import { MatchEndPanel } from './MatchEndPanel'
import { MatchMap } from './MatchMap'
import { MatchScoreboard } from './MatchScoreboard'
import { usePlaybackClock } from './usePlaybackClock'
import { VersusPanel } from './VersusPanel'
import { WinChanceBar } from './WinChanceBar'

interface MatchViewProps {
  teams: MatchTeams
  level: BotLevel
  seed: number
  onRematch: (level: BotLevel) => void
  onNewTeam: () => void
}

/** How many kill-feed entries stay on screen while the match plays. */
const FEED_LIMIT = 5

/** Versus screen, then the match played back in about 20 seconds, then the result. */
export function MatchView({ teams, level, seed, onRematch, onNewTeam }: MatchViewProps) {
  const match = useMemo(() => simulateMatch(teams, seed), [teams, seed])
  const lines = useMemo(() => commentate(match, teams), [match, teams])
  const timeline = useMemo(() => buildTimeline(match.events), [match])
  const chances = useMemo(() => winChanceTimeline(match, teams), [match, teams])
  const [started, setStarted] = useState(false)
  const [showFullFeed, setShowFullFeed] = useState(false)
  const { elapsed, skip } = usePlaybackClock(timeline.total, started)

  if (!started) return <VersusPanel teams={teams} botLabel={BOT_PROFILES[level].label} onStart={() => setStarted(true)} />

  const shown = eventsShown(timeline, elapsed)
  const ended = elapsed >= timeline.total
  const clock = gameClock(match.events, timeline, elapsed)
  const score = liveScore(match.events, shown, clock)
  const stats = statsAfter(match.events, shown)
  const shownEvents = match.events.slice(0, shown)
  const lastBig = shownEvents.findLastIndex(({ big }) => big)
  const summary = ended ? summarizeMatch(match, lines) : null

  const fightIndex = activeBigEvent(match.events, timeline, elapsed)
  const fightEvent = fightIndex === null ? undefined : match.events[fightIndex]
  const fightStart = fightIndex === null ? 0 : (timeline.starts[fightIndex] ?? 0)
  const fightEnd = fightIndex === null ? 1 : (timeline.starts[fightIndex + 1] ?? timeline.total)
  const fight = fightEvent && (
    <FightScene key={fightIndex} event={fightEvent} teams={teams} progress={(elapsed - fightStart) / (fightEnd - fightStart)} />
  )

  return (
    <div className="flex w-full max-w-5xl flex-col gap-3 lg:flex-row lg:items-start lg:gap-6">
      <div className="flex w-full flex-col gap-3 lg:sticky lg:top-4 lg:w-[26rem] lg:shrink-0">
        <motion.div
          key={lastBig}
          animate={lastBig >= 0 ? { x: [0, -8, 8, -5, 5, 0] } : undefined}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-3"
        >
          <MatchScoreboard teams={teams} score={score} clock={clock} />
          <WinChanceBar history={chances.slice(0, shown + 1)} />
        </motion.div>
        <div className="mx-auto w-full max-w-[17rem] sm:max-w-sm lg:max-w-none">
          <MatchMap events={shownEvents} overlay={fight} />
        </div>
        {!ended && (
          <button
            type="button"
            onClick={skip}
            className="self-center rounded-md border border-gold/30 px-4 py-1 text-sm font-semibold text-gold-light/70 transition hover:border-gold"
          >
            Skip to the end ⏭
          </button>
        )}
      </div>

      <div className="flex w-full flex-col gap-3 lg:flex-1">
        {summary && (
          <MatchEndPanel
            match={match}
            teams={teams}
            lines={lines}
            summary={summary}
            level={level}
            onRematch={onRematch}
            onNewTeam={onNewTeam}
          />
        )}
        <ChampionScoreboard teams={teams} stats={stats} awards={summary ? { mvp: summary.mvp, feeder: summary.feeder } : undefined} />
        <EventFeed
          events={match.events}
          lines={lines}
          teams={teams}
          shown={shown}
          limit={ended && showFullFeed ? undefined : FEED_LIMIT}
        />
        {ended && !showFullFeed && match.events.length > FEED_LIMIT && (
          <button type="button" onClick={() => setShowFullFeed(true)} className="text-sm text-hextech underline-offset-4 hover:underline">
            Show the whole match ({match.events.length} events)
          </button>
        )}
      </div>
    </div>
  )
}
