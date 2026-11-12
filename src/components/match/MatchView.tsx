import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { BOT_PROFILES, type BotLevel } from '../../game/match/bots'
import { CASTER_NAMES, commentate, roastWorstPlayer } from '../../game/match/commentary'
import { buildHighlightReel } from '../../game/match/highlights'
import { activeBigEvent, buildTimeline, eventsShown, gameClock, liveScore } from '../../game/match/playback'
import { simulateMatch } from '../../game/match/simulateMatch'
import { statsAfter } from '../../game/match/stats'
import { matchStory, standouts, summarizeMatch } from '../../game/match/summary'
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


/** Versus screen, then the highlights of the match in about 14 seconds, then the result. */
export function MatchView({ teams, level, seed, onRematch, onNewTeam }: MatchViewProps) {
  const match = useMemo(() => simulateMatch(teams, seed), [teams, seed])
  const reel = useMemo(() => buildHighlightReel(match, teams), [match, teams])
  const reelMatch = useMemo(() => ({ ...match, events: reel.events }), [match, reel])
  const lines = useMemo(() => commentate(reelMatch, teams), [reelMatch, teams])
  const timeline = useMemo(() => buildTimeline(reel.events), [reel])
  const chances = useMemo(() => winChanceTimeline(match, teams), [match, teams])
  const [started, setStarted] = useState(false)

  const { elapsed, skip } = usePlaybackClock(timeline.total, started)

  if (!started) return <VersusPanel teams={teams} botLabel={BOT_PROFILES[level].label} onStart={() => setStarted(true)} />

  const shown = eventsShown(timeline, elapsed)
  const ended = elapsed >= timeline.total
  const clock = gameClock(reel.events, timeline, elapsed)
  const score = liveScore(reel.events, shown, clock)
  const stats = statsAfter(match.events, shown === 0 ? 0 : (reel.sources[shown - 1] ?? 0) + 1)
  const history = [chances[0] ?? 0.5, ...reel.sources.slice(0, shown).map((source) => chances[source + 1] ?? 0.5)]
  const shownEvents = reel.events.slice(0, shown)
  const lastBig = shownEvents.findLastIndex(({ big }) => big)
  const summary = ended ? summarizeMatch(reelMatch, lines) : null
  const worstRoast = summary && roastWorstPlayer(match, teams, summary.feeder)
  const story = summary ? matchStory(match, teams, summary) : ''
  const live = standouts(stats)

  const fightIndex = activeBigEvent(reel.events, timeline, elapsed)
  const fightEvent = fightIndex === null ? undefined : reel.events[fightIndex]
  const fightStart = fightIndex === null ? 0 : (timeline.starts[fightIndex] ?? 0)
  const fightEnd = fightIndex === null ? 1 : (timeline.starts[fightIndex + 1] ?? timeline.total)
  const fight = fightEvent && (
    <FightScene key={fightIndex} event={fightEvent} line={fightIndex === null ? null : (lines[fightIndex] ?? null)} teams={teams} progress={(elapsed - fightStart) / (fightEnd - fightStart)} />
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
          <WinChanceBar history={history} />
        </motion.div>
        {/* The fight scene covers the full width, wider than the small phone map, so it is easier to follow. */}
        <div className="relative w-full">
          <div className="mx-auto w-full max-w-[17rem] sm:max-w-sm lg:max-w-none">
            <MatchMap events={shownEvents} />
          </div>
          <AnimatePresence>{fight}</AnimatePresence>
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
            match={reelMatch}
            teams={teams}
            lines={lines}
            summary={summary}
            story={story}
            level={level}
            onRematch={onRematch}
            onNewTeam={onNewTeam}
          />
        )}
        <ChampionScoreboard
          teams={teams}
          stats={stats}
          best={summary ? summary.mvp : live.best}
          worst={summary ? summary.feeder : live.worst}
          final={summary !== null}
        />
        {worstRoast && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-lg border border-red-400/30 bg-red-950/30 px-3 py-2 text-sm text-gold-light/90"
          >
            <span aria-hidden="true">💀 </span>
            <span className="italic">“{worstRoast.text}”</span>
            <span className="text-xs text-gold/60 not-italic"> — {CASTER_NAMES[worstRoast.caster]}</span>
          </motion.p>
        )}
        <EventFeed events={reel.events} lines={lines} teams={teams} shown={shown} />
      </div>
    </div>
  )
}
