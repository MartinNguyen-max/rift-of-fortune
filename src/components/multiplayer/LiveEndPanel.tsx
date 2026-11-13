import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { championIconUrl, endOfGameIconUrl } from '../../data'
import { CASTER_NAMES, formatGameTime, type CommentaryLine } from '../../game/match/commentary'
import { formatKda, type MatchSummary } from '../../game/match/summary'
import type { MatchResult, MatchTeams, Side } from '../../game/match/types'
import { MINI_GAMES } from '../../game/minigames/catalog'
import { MINI_GAME_RULES } from '../../game/minigames/registry'
import { eventSetup, type LiveEvent } from '../../game/multiplayer/liveEvents'
import type { RoundState } from '../../game/multiplayer/session'
import { ROLE_LABELS } from '../../game/roles'
import { Button } from '../Button'
import { championIconById } from '../minigames/miniGameArt'
import { routeHref } from '../useHashRoute'
import { EmoteBar } from './Emotes'
import { SeriesScore } from './SeriesScore'
import type { Room } from './useRoom'

interface LiveEndPanelProps {
  room: Room
  round: RoundState
  events: readonly LiveEvent[]
  mySide: Side
  won: boolean
  /** The finished match as watched (reel events), or null after a surrender. */
  match: MatchResult | null
}

/** On phones the result is below the map: scroll to it once the ending has played. */
const SCROLL_DELAY_MS = 1200

/** Victory or Defeat, the live events, the series, Rematch and emotes. Nothing else. */
export function LiveEndPanel({ room, round, events, mySide, won, match }: LiveEndPanelProps) {
  const { me, opponent, setReady, leaveRound, wins, sendEmote } = room
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!window.matchMedia('(max-width: 1023px)').matches) return
    const id = window.setTimeout(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), SCROLL_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [])
  const opponentInfo = round.players.find(({ id }) => id !== me.id)
  const opponentHere = opponent !== null && opponent.id === opponentInfo?.id
  const last = match?.events[match.events.length - 1]

  const howItEnded = round.surrendered
    ? round.surrendered === me.id
      ? 'You surrendered.'
      : `${opponentInfo?.name ?? 'Your opponent'} surrendered.`
    : last?.kind === 'surrender'
      ? `${last.side === 'blue' ? 'Their team' : 'Your team'} surrendered at ${formatGameTime(match?.duration ?? 0)}`
      : `Nexus destroyed at ${formatGameTime(match?.duration ?? 0)}`

  return (
    <motion.section
      ref={panel}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 14 }}
      className="flex flex-col gap-4 rounded-xl border-2 border-gold/50 bg-panel/90 p-4 text-center shadow-2xl shadow-black/60"
    >
      <div className="flex flex-col items-center">
        <motion.img
          src={endOfGameIconUrl(won ? 'victory' : 'defeat')}
          alt=""
          className={`-mb-1 size-20 drop-shadow-[0_0_18px_rgb(200_170_110/0.45)] sm:size-24 ${won ? '' : 'grayscale-[30%]'}`}
          initial={{ scale: 0.3, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.1 }}
        />
        <h2 className={`font-display text-5xl font-black tracking-wider ${won ? 'text-gold' : 'text-red-400'}`}>
          {won ? 'Victory' : 'Defeat'}
        </h2>
        <p className="text-sm text-gold-light/70">{howItEnded}</p>
      </div>

      <LiveEventsSummary round={round} events={events} mySide={mySide} />

      {opponentInfo && <SeriesScore me={me} opponent={opponentInfo} wins={wins} />}

      <div className="flex flex-col items-center gap-2">
        {opponentHere ? (
          <>
            <Button onClick={() => setReady(!me.ready)} className={me.ready ? 'bg-gold/20' : ''}>
              {me.ready ? 'Rematch ✓' : 'Rematch'}
            </Button>
            <p className="text-sm text-gold-light/70" aria-live="polite">
              {me.ready && opponent.ready
                ? 'Starting a new draft…'
                : opponent.ready
                  ? `${opponent.name} wants a rematch!`
                  : me.ready
                    ? `Waiting for ${opponent.name}…`
                    : 'New teams, same lobby.'}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-gold-light/70">Your opponent left the lobby.</p>
            <Button onClick={leaveRound}>Back to lobby</Button>
          </>
        )}
      </div>

      <EmoteBar onEmote={sendEmote} />

      <a href={routeHref('play')} className="text-sm text-hextech underline-offset-4 hover:underline">
        Leave lobby
      </a>
    </motion.section>
  )
}

function LiveEventsSummary({ round, events, mySide }: { round: RoundState; events: readonly LiveEvent[]; mySide: Side }) {
  const seed = round.match?.seed ?? 0
  const played = events.flatMap((live, index) => {
    const result = round.events[index]?.result
    return result ? [{ live, index, result }] : []
  })
  if (played.length === 0) return null
  const theirSide: Side = mySide === 'blue' ? 'red' : 'blue'

  return (
    <ul className="flex flex-col gap-1 rounded-lg border border-hextech/30 bg-hextech/5 p-2 text-left text-sm">
      <li className="px-1 text-[10px] tracking-widest text-hextech uppercase">Live events</li>
      {played.map(({ live, index, result }) => {
        const won = result.winner === mySide
        const info = MINI_GAMES[live.game]
        const setup = eventSetup(seed, index, live.late, round.settings.bothRoles)
        const format = (score: number) => MINI_GAME_RULES[live.game].formatScore(score, setup)
        return (
          <li key={index} className="flex items-center gap-2 px-1">
            <img src={championIconById(info.champion)} alt="" className="size-6 shrink-0 rounded-full" />
            <span className="min-w-0 flex-1 text-gold-light/90 [overflow-wrap:anywhere]">{info.name}</span>
            <span className="text-right font-mono text-[11px] text-gold-light/60">
              {format(result.scores[mySide])} – {format(result.scores[theirSide])}
            </span>
            <span className={`w-11 shrink-0 text-right font-bold ${won ? 'text-hextech' : 'text-red-400'}`}>{won ? 'Won' : 'Lost'}</span>
          </li>
        )
      })}
    </ul>
  )
}

interface MatchStoryProps {
  /** Your team on blue. */
  teams: MatchTeams
  summary: MatchSummary
  story: string
  won: boolean
  roast: CommentaryLine | null
}

/** How the match went, the MVP and the casters' roast: further down, for whoever wants to read it. */
export function MatchStory({ teams, summary, story, won, roast }: MatchStoryProps) {
  const mvp = teams[summary.mvp.side].rating.champions.find(({ role }) => role === summary.mvp.role)
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-gold/20 bg-abyss/50 p-3" aria-label="How it went">
      {story && (
        <div className="text-left">
          <p className="mb-1 text-[10px] tracking-widest text-gold/70 uppercase">How it went</p>
          <p className="text-sm leading-relaxed text-gold-light/90">{story}</p>
        </div>
      )}
      {mvp && (
        <div className="flex items-center gap-3">
          <img src={championIconUrl(mvp.champion.image)} alt="" className="size-12 rounded-full border-2 border-gold" />
          <div className="text-left">
            <p className="text-[10px] tracking-widest text-gold/70 uppercase">{won ? 'MVP' : 'Enemy MVP'}</p>
            <p className="font-display font-bold text-gold-light">
              {mvp.champion.name} <span className="text-xs text-gold-light/60">{ROLE_LABELS[mvp.role]}</span>
            </p>
            <p className="font-mono text-sm text-gold-light/80">{formatKda(summary.mvp.kda)}</p>
          </div>
        </div>
      )}
      {roast && (
        <p className="rounded-lg border border-red-400/30 bg-red-950/30 px-3 py-2 text-sm text-gold-light/90">
          <span aria-hidden="true">💀 </span>
          <span className="italic">“{roast.text}”</span>
          <span className="text-xs text-gold/60 not-italic"> — {CASTER_NAMES[roast.caster]}</span>
        </p>
      )}
    </section>
  )
}
