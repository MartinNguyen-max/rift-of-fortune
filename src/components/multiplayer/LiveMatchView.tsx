import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { commentate, roastWorstPlayer } from '../../game/match/commentary'
import { activeBigEvent, eventsShown, gameClock, liveScore } from '../../game/match/playback'
import { finishedMatch, simulateLiveMatch } from '../../game/match/simulateMatch'
import { statsAfter } from '../../game/match/stats'
import { matchStory, standouts, summarizeMatch } from '../../game/match/summary'
import type { MatchTeams, Side } from '../../game/match/types'
import { buildLiveReel, liveChances, liveTimeline, mirrorMatch } from '../../game/multiplayer/liveReel'
import { teamsFor } from '../../game/multiplayer/roundTeams'
import { decidedWinners, roundEvents, sideOf, type RoundState } from '../../game/multiplayer/session'
import { Collapsible } from '../Collapsible'
import { CasterStack } from '../match/CasterStack'
import { ChampionScoreboard } from '../match/ChampionScoreboard'
import { EventFeed } from '../match/EventFeed'
import { FightScene } from '../match/FightScene'
import { MatchMap } from '../match/MatchMap'
import { MatchScoreboard } from '../match/MatchScoreboard'
import { MatchSounds } from '../match/MatchSounds'
import { usePlaybackClock } from '../match/usePlaybackClock'
import { WinChanceBar } from '../match/WinChanceBar'
import { EmoteBar } from './Emotes'
import { LiveEndPanel, MatchStory } from './LiveEndPanel'
import { LiveEventStage } from './LiveEventStage'
import { SurrenderButton } from './SurrenderButton'
import type { Room } from './useRoom'

interface LiveMatchViewProps {
  room: Room
  round: RoundState
  /** Host on blue, as the simulation plays it. */
  teams: MatchTeams
}

/**
 * The match, played back like against bots, but it stops at each live event for a mini-game.
 * Both players run the same simulation, so they see the same match. Each sees their own team on
 * blue side. Kept calm: the details (champion scores, the full feed) are folded away.
 */
export function LiveMatchView({ room, round, teams }: LiveMatchViewProps) {
  const { me, opponent, send, sendEmote, finishRound } = room
  const seed = round.match?.seed ?? 0
  const mySide = sideOf(round, me.id)
  const opponentInfo = round.players.find(({ id }) => id !== me.id)
  const viewTeams = useMemo(() => teamsFor(teams, mySide), [teams, mySide])
  const { match: roundMatch, settings } = round
  const events = useMemo(() => roundEvents({ match: roundMatch, settings }), [roundMatch, settings])

  /** Live events whose result has been shown. The match only plays past those. */
  const [shownResults, setShownResults] = useState(0)
  const winnersKey = decidedWinners(round).slice(0, shownResults).join(',')
  const sim = useMemo(() => {
    const winners = winnersKey === '' ? [] : (winnersKey.split(',') as Side[])
    return simulateLiveMatch(teams, seed, { events, winners })
  }, [teams, seed, events, winnersKey])
  const match = useMemo(() => (mySide === 'blue' ? sim : mirrorMatch(sim)), [sim, mySide])
  const reel = useMemo(() => buildLiveReel(match, viewTeams), [match, viewTeams])
  const timeline = useMemo(() => liveTimeline(reel.events), [reel])
  const lines = useMemo(() => commentate({ seed, events: reel.events }, viewTeams), [seed, reel, viewTeams])
  const chances = useMemo(() => liveChances(match, viewTeams), [match, viewTeams])

  const surrendered = round.surrendered
  const { elapsed } = usePlaybackClock(timeline.total, surrendered === null)
  const caughtUp = elapsed >= timeline.total
  const pendingEvent = caughtUp && surrendered === null ? match.pendingEvent : null
  const pendingLive = pendingEvent === null ? undefined : events[pendingEvent]
  const finished = useMemo(() => finishedMatch(match), [match])
  const ended = finished !== null && caughtUp

  const winnerId = surrendered
    ? round.players.find(({ id }) => id !== surrendered)?.id
    : ended
      ? finished.winner === 'blue'
        ? me.id
        : opponentInfo?.id
      : undefined
  useEffect(() => {
    if (winnerId) finishRound(round.id, winnerId)
  }, [winnerId, finishRound, round.id])

  const nextEventShown = useCallback(() => setShownResults((count) => count + 1), [])

  const shown = eventsShown(timeline, elapsed)
  const clock = gameClock(reel.events, timeline, elapsed)
  const score = liveScore(reel.events, shown, clock)
  const stats = statsAfter(match.events, shown === 0 ? 0 : (reel.sources[shown - 1] ?? 0) + 1)
  const history = [chances[0] ?? 0.5, ...reel.sources.slice(0, shown).map((source) => chances[source + 1] ?? 0.5)]
  const shownEvents = reel.events.slice(0, shown)
  const lastBig = shownEvents.findLastIndex(({ big }) => big)

  const reelMatch = finished && { ...finished, events: reel.events }
  const summary = ended && reelMatch ? summarizeMatch(reelMatch, lines) : null
  const worstRoast = summary && finished && roastWorstPlayer(finished, viewTeams, summary.feeder)
  const story = summary && finished ? matchStory(finished, viewTeams, summary) : ''
  const live = standouts(stats)

  const fightIndex = surrendered ? null : activeBigEvent(reel.events, timeline, elapsed)
  const fightEvent = fightIndex === null ? undefined : reel.events[fightIndex]
  const fightStart = fightIndex === null ? 0 : (timeline.starts[fightIndex] ?? 0)
  const fightEnd = fightIndex === null ? 1 : (timeline.starts[fightIndex + 1] ?? timeline.total)
  const fight = fightEvent && (
    <FightScene
      key={fightIndex}
      event={fightEvent}
      line={fightIndex === null ? null : (lines[fightIndex] ?? null)}
      teams={viewTeams}
      progress={(elapsed - fightStart) / (fightEnd - fightStart)}
    />
  )
  const over = surrendered !== null || ended
  const opponentGone = opponentInfo !== undefined && opponent?.id !== opponentInfo.id
  const surrender = () => send({ type: 'surrender', round: round.id, player: me.id })

  return (
    <div className="flex w-full max-w-5xl flex-col gap-3 lg:flex-row lg:items-start lg:gap-6">
      <MatchSounds fightIndex={fightIndex} ended={over} won={winnerId === me.id} />
      {pendingEvent !== null && pendingLive && (
        <LiveEventStage
          key={pendingEvent}
          round={round}
          index={pendingEvent}
          live={pendingLive}
          myId={me.id}
          mySide={mySide}
          send={send}
          sendEmote={sendEmote}
          onDone={nextEventShown}
        />
      )}
      <div className="flex w-full flex-col gap-3 lg:sticky lg:top-4 lg:w-[26rem] lg:shrink-0">
        {opponentGone && !over && (
          <p role="status" className="rounded-lg border border-red-400/40 bg-red-950/40 px-3 py-2 text-center text-sm text-gold-light/90">
            {opponentInfo.name} left. If they don't come back within 30 seconds, they surrender.
          </p>
        )}
        <motion.div
          key={lastBig}
          animate={lastBig >= 0 ? { x: [0, -8, 8, -5, 5, 0] } : undefined}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-3"
        >
          <MatchScoreboard teams={viewTeams} score={score} clock={clock} compact />
          <WinChanceBar history={history} />
        </motion.div>
        <div className="relative w-full">
          <div className="mx-auto w-full max-w-[17rem] sm:max-w-sm lg:max-w-none">
            <MatchMap events={shownEvents} />
          </div>
          <AnimatePresence>{fight}</AnimatePresence>
        </div>
        {!over && <CasterStack events={reel.events} lines={lines} shown={shown} />}
        {!over && <EmoteBar onEmote={sendEmote} />}
        {!over && <SurrenderButton onSurrender={surrender} />}
      </div>

      <div className="flex w-full flex-col gap-3 lg:flex-1">
        {over && (
          <LiveEndPanel room={room} round={round} events={events} mySide={mySide} won={winnerId === me.id} match={reelMatch && ended ? reelMatch : null} />
        )}
        <Collapsible title="Champion scores">
          <ChampionScoreboard
            teams={viewTeams}
            stats={stats}
            best={summary ? summary.mvp : live.best}
            worst={summary ? summary.feeder : live.worst}
            final={summary !== null}
          />
        </Collapsible>
        <Collapsible title="All commentary">
          <EventFeed events={reel.events} lines={lines} teams={viewTeams} shown={shown} />
        </Collapsible>
        {summary && <MatchStory teams={viewTeams} summary={summary} story={story} won={winnerId === me.id} roast={worstRoast ?? null} />}
      </div>
    </div>
  )
}
