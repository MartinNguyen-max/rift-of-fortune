import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { championIconUrl, endOfGameIconUrl, gameData } from '../../data'
import type { Champion } from '../../data/types'
import type { Side } from '../../game/match/types'
import { MINI_GAMES } from '../../game/minigames/catalog'
import { LANE_ORDER, laneChampions, laneResults, lanesOutcome, LIVES, livesLeft, type LaneResult, type LanesOutcome } from '../../game/multiplayer/lanes'
import type { LiveEvent } from '../../game/multiplayer/liveEvents'
import { roundEvents, sideOf, type RoundState } from '../../game/multiplayer/session'
import { ROLE_LABELS } from '../../game/roles'
import { playSound } from '../../services/sound'
import { championIconById } from '../minigames/miniGameArt'
import { BigCall } from '../minigames/parts'
import { useTimeout } from '../minigames/timing'
import { routeHref } from '../useHashRoute'
import { CoinFlip } from './CoinFlip'
import { EmoteBar } from './Emotes'
import { RematchControls } from './LiveEndPanel'
import { LiveEventStage } from './LiveEventStage'
import { COIN_FLIP_MS, type LaneMatchup } from './liveEventText'
import { SeriesScore } from './SeriesScore'
import { SurrenderButton } from './SurrenderButton'
import type { Room } from './useRoom'

/** How long "Lane 2 · Jungle: Lee Sin vs Vi" shows before the mini-game opens. */
const LANE_INTRO_MS = 2600

const otherSide = (side: Side): Side => (side === 'blue' ? 'red' : 'blue')
const laneLabel = (index: number) => `Lane ${index + 1} · ${ROLE_LABELS[LANE_ORDER[index] ?? 'TOP']}`

/**
 * Five lanes, no champ select: both teams side by side with VS in the middle and five lives each.
 * The lanes fight in order, each in one mini-game; the champion who loses is dead and their team
 * loses a life. After all five, the most lives left wins; level lives go to a coin flip.
 */
export function LanesView({ room, round }: { room: Room; round: RoundState }) {
  const { me, opponent, send, sendEmote, finishRound } = room
  const mySide = sideOf(round, me.id)
  const theirSide = otherSide(mySide)
  const { match, settings } = round
  const seed = match?.seed ?? 0
  const lineUps = useMemo(() => laneChampions({ match }, gameData.champions), [match])
  const events = useMemo(() => roundEvents({ match, settings }), [match, settings])

  const decided = laneResults(round)
  /** Lanes whose result has been shown. A player who rejoins skips the ones already fought. */
  const [shown, setShown] = useState(() => decided.length)
  const [fighting, setFighting] = useState(false)
  const results = decided.slice(0, shown)
  const surrendered = round.surrendered
  const current = !surrendered && shown < events.length ? shown : null
  const live = current === null ? undefined : events[current]

  useTimeout(() => setFighting(true), LANE_INTRO_MS, current !== null && !fighting)
  const nextLane = useCallback(() => {
    setShown((count) => count + 1)
    setFighting(false)
  }, [])

  const outcome: LanesOutcome | null = surrendered
    ? { winner: sideOf(round, surrendered) === 'blue' ? 'red' : 'blue', lives: { blue: livesLeft(results, 'blue'), red: livesLeft(results, 'red') }, coinFlip: false }
    : lanesOutcome(results, events.length, seed)
  const winnerId = outcome ? round.players[outcome.winner === 'blue' ? 0 : 1]?.id : undefined
  useEffect(() => {
    if (winnerId) finishRound(round.id, winnerId)
  }, [winnerId, finishRound, round.id])

  const matchup = (index: number): LaneMatchup => ({
    label: laneLabel(index),
    mine: lineUps?.[mySide][index]?.name ?? 'Your champion',
    theirs: lineUps?.[theirSide][index]?.name ?? 'Their champion',
  })
  const opponentInfo = round.players.find(({ id }) => id !== me.id)
  const opponentGone = opponentInfo !== undefined && opponent?.id !== opponentInfo.id

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-4">
      {current !== null && live && fighting && (
        <LiveEventStage
          key={current}
          round={round}
          index={current}
          live={live}
          myId={me.id}
          mySide={mySide}
          send={send}
          sendEmote={sendEmote}
          onDone={nextLane}
          lane={matchup(current)}
        />
      )}
      {opponentGone && !outcome && opponentInfo && (
        <p role="status" className="w-full rounded-lg border border-red-400/40 bg-red-950/40 px-3 py-2 text-center text-sm text-gold-light/90">
          {opponentInfo.name} left. If they don't come back within 30 seconds, they surrender.
        </p>
      )}
      <LaneBoard
        round={round}
        mySide={mySide}
        lineUps={lineUps}
        events={events}
        results={results}
        current={current}
      />
      <AnimatePresence mode="wait">
        {current !== null && live && !fighting && <LaneIntro key={current} index={current} live={live} matchup={matchup(current)} />}
      </AnimatePresence>
      {outcome && <LanesEndPanel room={room} round={round} outcome={outcome} mySide={mySide} />}
      {!outcome && <EmoteBar onEmote={sendEmote} />}
      {!outcome && <SurrenderButton onSurrender={() => send({ type: 'surrender', round: round.id, player: me.id })} />}
    </div>
  )
}

interface LaneBoardProps {
  round: RoundState
  mySide: Side
  lineUps: Record<Side, (Champion | null)[]> | null
  events: readonly LiveEvent[]
  /** The results shown so far. */
  results: readonly LaneResult[]
  current: number | null
}

/** Both teams side by side, a lane per row, with their lives on top. A champion who lost is dead. */
function LaneBoard({ round, mySide, lineUps, events, results, current }: LaneBoardProps) {
  const theirSide = otherSide(mySide)
  const name = (side: Side) => round.players[side === 'blue' ? 0 : 1]?.name ?? 'Team ?'
  return (
    <section className="flex w-full flex-col gap-3 rounded-xl border border-gold/30 bg-panel/80 p-3 shadow-2xl shadow-black/50 sm:p-4" aria-label="Five lanes">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <Lives name={name(mySide)} lives={livesLeft(results, mySide)} you />
        <span className="pb-1 font-display text-3xl font-black text-gold sm:text-4xl">VS</span>
        <Lives name={name(theirSide)} lives={livesLeft(results, theirSide)} you={false} />
      </div>
      <ol className="flex flex-col gap-1.5">
        {LANE_ORDER.map((role, index) => {
          const result = results[index]
          const live = events[index]
          return (
            <li
              key={role}
              className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border p-1.5 transition ${
                index === current ? 'border-gold bg-gold/10 shadow-md shadow-gold/20' : 'border-gold/15 bg-abyss/50'
              } ${result === undefined && index !== current ? 'opacity-70' : ''}`}
            >
              <LaneChampion champion={lineUps?.[mySide][index] ?? null} dead={result === theirSide} side="left" />
              <div className="flex w-16 flex-col items-center text-center sm:w-32">
                <span className="text-[10px] font-bold tracking-widest text-gold/80 uppercase">{ROLE_LABELS[role]}</span>
                {live && (
                  <span className="hidden text-[11px] leading-tight text-gold-light/60 sm:block">{MINI_GAMES[live.game].name}</span>
                )}
                <ResultChip result={result} mySide={mySide} />
              </div>
              <LaneChampion champion={lineUps?.[theirSide][index] ?? null} dead={result === mySide} side="right" />
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** A team's name and five hearts that go dark as champions fall. */
function Lives({ name, lives, you }: { name: string; lives: number; you: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${you ? 'items-start' : 'items-end'}`}>
      <span className={`max-w-full font-display text-sm leading-tight font-black [overflow-wrap:anywhere] sm:text-base ${you ? 'text-hextech' : 'text-red-400'}`}>
        {name}
      </span>
      <div className={`flex w-full gap-1 ${you ? '' : 'flex-row-reverse'}`} role="meter" aria-label={`${lives} of ${LIVES} lives`} aria-valuenow={lives} aria-valuemin={0} aria-valuemax={LIVES}>
        {Array.from({ length: LIVES }, (_, index) => (
          <motion.span
            key={index}
            animate={index < lives ? { opacity: 1, scaleY: 1 } : { opacity: 0.25, scaleY: 0.6 }}
            className={`h-3 flex-1 rounded-sm ${index < lives ? (you ? 'bg-hextech' : 'bg-red-500') : 'bg-gold-light/30'}`}
          />
        ))}
      </div>
    </div>
  )
}

function LaneChampion({ champion, dead, side }: { champion: Champion | null; dead: boolean; side: 'left' | 'right' }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${side === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <span className="relative shrink-0">
        <motion.img
          src={champion ? championIconUrl(champion.image) : ''}
          alt=""
          animate={dead ? { filter: 'grayscale(1)', opacity: 0.45 } : { filter: 'grayscale(0)', opacity: 1 }}
          className={`size-9 rounded-full border-2 sm:size-12 ${side === 'left' ? 'border-hextech' : 'border-red-400'}`}
        />
        {dead && (
          <motion.span
            initial={{ scale: 2.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center text-2xl"
            aria-hidden="true"
          >
            💀
          </motion.span>
        )}
      </span>
      <span className={`min-w-0 text-xs leading-tight font-semibold break-words sm:text-sm ${dead ? 'text-gold-light/40 line-through' : 'text-gold-light'}`}>
        {champion?.name ?? '?'}
        {dead && <span className="sr-only"> (dead)</span>}
      </span>
    </div>
  )
}

function ResultChip({ result, mySide }: { result: LaneResult | undefined; mySide: Side }) {
  if (result === undefined) return null
  const text = result === 'draw' ? 'Tie' : result === mySide ? 'Won' : 'Lost'
  const tone = result === 'draw' ? 'text-gold-light/80' : result === mySide ? 'text-hextech' : 'text-red-400'
  return <span className={`text-xs font-black uppercase ${tone}`}>{text}</span>
}

/** Before each lane: which lane, who fights who, and the mini-game. */
function LaneIntro({ index, live, matchup }: { index: number; live: LiveEvent; matchup: LaneMatchup }) {
  const info = MINI_GAMES[live.game]
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.1, opacity: 0 }}
      className="flex flex-col items-center gap-2 text-center"
      role="status"
    >
      <p className="text-xs tracking-[0.3em] text-hextech uppercase">{laneLabel(index)}</p>
      <p className="font-display text-2xl leading-tight font-black text-gold-light sm:text-3xl">
        <span className="text-hextech">{matchup.mine}</span> <span className="text-gold/70">vs</span>{' '}
        <span className="text-red-400">{matchup.theirs}</span>
      </p>
      <p className="flex items-center gap-2 text-sm text-gold-light/80">
        <img src={championIconById(info.champion)} alt="" className="size-6 rounded-full" />
        {info.name}
      </p>
    </motion.div>
  )
}

interface LanesEndPanelProps {
  room: Room
  round: RoundState
  outcome: LanesOutcome
  mySide: Side
}

/** Victory or Defeat (after a coin flip if the lives were level), the series, Rematch and emotes. */
function LanesEndPanel({ room, round, outcome, mySide }: LanesEndPanelProps) {
  const { me, wins, sendEmote } = room
  const won = outcome.winner === mySide
  const [flipped, setFlipped] = useState(!outcome.coinFlip)
  useTimeout(() => setFlipped(true), COIN_FLIP_MS + 900, !flipped)
  useEffect(() => {
    if (flipped) playSound(won ? 'victory' : 'defeat')
  }, [flipped, won])
  const opponentInfo = round.players.find(({ id }) => id !== me.id)
  const theirSide = otherSide(mySide)
  const howItEnded = round.surrendered
    ? round.surrendered === me.id
      ? 'You surrendered.'
      : `${opponentInfo?.name ?? 'Your opponent'} surrendered.`
    : `${outcome.lives[mySide]} lives left to ${outcome.lives[theirSide]}${outcome.coinFlip ? ': level, so a coin flip decided' : ''}.`

  return (
    <motion.section
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 14 }}
      className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border-2 border-gold/50 bg-panel/90 p-4 text-center shadow-2xl shadow-black/60"
    >
      {!flipped ? (
        <>
          <BigCall text="TIE!" tone="plain" size="large" sub={`${outcome.lives[mySide]} lives each`} />
          <CoinFlip youWin={won} caption={won ? 'It lands on you!' : `It lands on ${opponentInfo?.name ?? 'them'}`} />
        </>
      ) : (
        <div className="flex flex-col items-center">
          <motion.img
            src={endOfGameIconUrl(won ? 'victory' : 'defeat')}
            alt=""
            className={`-mb-1 size-20 drop-shadow-[0_0_18px_rgb(200_170_110/0.45)] sm:size-24 ${won ? '' : 'grayscale-[30%]'}`}
            initial={{ scale: 0.3, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.1 }}
          />
          <h2 className={`font-display text-5xl font-black tracking-wider ${won ? 'text-gold' : 'text-red-400'}`}>{won ? 'Victory' : 'Defeat'}</h2>
          <p className="text-sm text-gold-light/70">{howItEnded}</p>
        </div>
      )}
      {opponentInfo && <SeriesScore me={me} opponent={opponentInfo} wins={wins} />}
      <RematchControls room={room} round={round} />
      <EmoteBar onEmote={sendEmote} />
      <a href={routeHref('play')} className="text-sm text-hextech underline-offset-4 hover:underline">
        Leave lobby
      </a>
    </motion.section>
  )
}
