import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { mapIconUrl } from '../../data'
import type { Side } from '../../game/match/types'
import { finisherFor } from '../../game/finishers'
import { MINI_GAMES } from '../../game/minigames/catalog'
import { MINI_GAME_RULES } from '../../game/minigames/registry'
import { other } from '../../game/minigames/versus'
import { eventSetup, type LiveEvent } from '../../game/multiplayer/liveEvents'
import type { Emote, EventResult, PlayerId, RoomMessage } from '../../game/multiplayer/protocol'
import { eventStart, playerIndex, playerOn, TIMINGS, type LiveEventState, type RoundState } from '../../game/multiplayer/session'
import { Button } from '../Button'
import { FinisherVideo } from '../minigames/FinisherVideo'
import { GameOpening } from '../minigames/GameOpening'
import { MiniGameIntro } from '../minigames/MiniGameIntro'
import { BigCall } from '../minigames/parts'
import { useTimeout } from '../minigames/timing'
import type { Contestant } from '../minigames/types'
import { MINI_GAME_VIEWS } from '../minigames/views'
import { useCountdown } from '../useCountdown'
import { EmoteBar } from './Emotes'
import { CoinFlip } from './CoinFlip'
import { COIN_FLIP_MS, eventPrize, lanePrize, roleNote, type LaneMatchup } from './liveEventText'

/** How long the result stays up before the match goes on. */
const REVEAL_MS = 6500
/** If the result is in but your screen is still animating (or stuck), show it after this. */
const RESULT_WAIT_MS = 4000

interface LiveEventStageProps {
  round: RoundState
  index: number
  live: LiveEvent
  myId: PlayerId
  mySide: Side
  send: (message: RoomMessage) => void
  sendEmote: (emote: Emote) => void
  /** The result has been shown: play on. */
  onDone: () => void
  /** Five lanes: the lane being fought. A tie is then a draw where both champions live. */
  lane?: LaneMatchup
}

type Phase = 'intro' | 'game' | 'finisher' | 'reveal'

/**
 * One live event over the match: the tutorial until both press Ready (or time runs out), the
 * mini-game itself (the same screen as against the bot), then a big result with emotes.
 */
export function LiveEventStage({ round, index, live, myId, mySide, send, sendEmote, onDone, lane }: LiveEventStageProps) {
  const event = round.events[index]
  const seed = round.match?.seed ?? 0
  const setup = useMemo(() => eventSetup(seed, index, live.late, round.settings.bothRoles), [seed, index, live.late, round.settings.bothRoles])
  const me = playerIndex(round, myId) ?? 0
  const info = MINI_GAMES[live.game]
  const opponentName = playerOn(round, mySide === 'blue' ? 'red' : 'blue')?.name ?? 'Opponent'
  // The host plays the game's champion and the guest the other one (Caitlyn vs Jhin), so both
  // see the same matchup and the same winner's finisher.
  const players = useMemo<[Contestant, Contestant]>(() => {
    const name = (player: 0 | 1) => (player === me ? 'You' : opponentName)
    return [
      { name: name(0), champion: info.champion, isBot: false },
      { name: name(1), champion: info.botChampion, isBot: false },
    ]
  }, [info, opponentName, me])

  const [introOver, setIntroOver] = useState(false)
  // A player who rejoins after the game began skips the face-off.
  const [opened, setOpened] = useState(() => {
    const start = event ? eventStart(event) : null
    return start !== null && Date.now() > start + TIMINGS.opening * 1000
  })
  const open = useCallback(() => setOpened(true), [])
  const [shown, setShown] = useState(false)
  const [resultWaited, setResultWaited] = useState(false)
  const [finisherDone, setFinisherDone] = useState(false)
  const result = event?.result ?? null
  // A tie has no real winner, so no finisher (in the match a coin flip shows who gets the event).
  const finisher = result && !result.tie && round.settings.animations ? finisherFor(players[result.winner === 'blue' ? 0 : 1].champion) : null
  const bothReady = event?.readyAt !== null && event?.readyAt !== undefined
  const resultPhase: Phase = finisher && !finisherDone ? 'finisher' : 'reveal'
  const phase: Phase = result && (shown || resultWaited) ? resultPhase : introOver || bothReady ? 'game' : 'intro'

  useEffect(() => {
    send({ type: 'arrived', round: round.id, event: index, player: myId })
  }, [send, round.id, index, myId])
  useTimeout(() => setIntroOver(true), TIMINGS.intro * 1000)
  useTimeout(() => setResultWaited(true), RESULT_WAIT_MS, result !== null)
  const coinFlip = result?.tie === true && !lane
  useTimeout(onDone, REVEAL_MS + (coinFlip ? COIN_FLIP_MS : 0), phase === 'reveal')

  const ready = useCallback(() => send({ type: 'eventReady', round: round.id, event: index, player: myId }), [send, round.id, index, myId])
  const sendMove = useCallback(
    (step: number, value: number) => send({ type: 'move', round: round.id, event: index, player: myId, step, value }),
    [send, round.id, index, myId],
  )
  const markShown = useCallback(() => setShown(true), [])
  const endFinisher = useCallback(() => setFinisherDone(true), [])
  const { Game } = MINI_GAME_VIEWS[live.game]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-abyss/90 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Live event: ${info.name}`}
    >
      <div className="flex w-full max-w-2xl flex-col gap-3 rounded-2xl border-2 border-gold/60 bg-panel p-3 shadow-2xl shadow-black sm:p-5">
        <p className="text-center text-[10px] tracking-[0.3em] text-hextech uppercase">
          {lane ? `${lane.label} · ${info.name}` : `Live event ${index + 1} / ${round.events.length} · ${info.name}`}
        </p>
        {phase === 'intro' && event && (
          <MiniGameIntro info={info} you={players[me]} them={players[other(me)]} live note={roleNote(live.game, setup, me)}>
            <ReadyButton event={event} myId={myId} opponentName={opponentName} onReady={ready} />
          </MiniGameIntro>
        )}
        {phase === 'game' && event && !opened && <GameOpening info={info} you={players[me]} them={players[other(me)]} onDone={open} />}
        {phase === 'game' && event && opened && (
          <Game setup={setup} me={me} moves={event.moves} sendMove={sendMove} onShown={markShown} players={players} />
        )}
        {phase === 'finisher' && finisher && result && <FinisherVideo finisher={finisher} won={result.winner === mySide} onDone={endFinisher} />}
        {phase === 'reveal' && event && result && (
          <EventResultView live={live} event={event} result={result} setup={setup} me={me} mySide={mySide} players={players} sendEmote={sendEmote} lane={lane} />
        )}
      </div>
    </motion.div>
  )
}

interface ReadyButtonProps {
  event: LiveEventState
  myId: PlayerId
  opponentName: string
  onReady: () => void
}

/** Ready, with the time left before the game starts anyway, and whether the opponent is ready. */
function ReadyButton({ event, myId, opponentName, onReady }: ReadyButtonProps) {
  const [deadline] = useState(() => Date.now() + TIMINGS.intro * 1000)
  const left = useCountdown(deadline)
  const iAmReady = event.ready.includes(myId)
  const theyAreReady = event.ready.some((id) => id !== myId)
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <Button onClick={onReady} disabled={iAmReady} className={iAmReady ? 'bg-gold/20' : ''}>
        {iAmReady ? 'Ready ✓' : 'Ready'}
      </Button>
      <p className={`text-sm ${theyAreReady ? 'font-semibold text-gold' : 'text-gold-light/60'}`} aria-live="polite">
        {theyAreReady ? `${opponentName} is ready ✓` : `Waiting for ${opponentName}…`}
      </p>
      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-abyss/80" role="timer" aria-label={`Starts in ${Math.ceil(left)} seconds`}>
        <div className="h-full bg-hextech transition-[width] duration-200 ease-linear" style={{ width: `${(left / TIMINGS.intro) * 100}%` }} />
      </div>
    </div>
  )
}

interface EventResultViewProps {
  live: LiveEvent
  event: LiveEventState
  result: EventResult
  setup: ReturnType<typeof eventSetup>
  me: 0 | 1
  mySide: Side
  players: [Contestant, Contestant]
  sendEmote: (emote: Emote) => void
  lane?: LaneMatchup
}

/**
 * The result as a picture: a huge WON or LOST, what it gives, the scores, and emotes to spam. A
 * tie in five lanes is a TIE; in the match the event needs a winner, so a coin flip lands first.
 */
function EventResultView({ live, event, result, setup, me, mySide, players, sendEmote, lane }: EventResultViewProps) {
  const won = result.winner === mySide
  const draw = result.tie && lane !== undefined
  const [flipped, setFlipped] = useState(!result.tie || draw)
  useTimeout(() => setFlipped(true), COIN_FLIP_MS, !flipped)
  const theirSide: Side = mySide === 'blue' ? 'red' : 'blue'
  const rules = MINI_GAME_RULES[live.game]
  const { Reveal } = MINI_GAME_VIEWS[live.game]
  const settled = rules.settle(event.moves, setup)
  const icon = !lane && (live.kind === 'baron' || live.kind === 'elder') ? mapIconUrl(live.kind) : null
  const prize = lane ? lanePrize(lane, draw ? 'tie' : won ? 'won' : 'lost') : eventPrize(live.kind, won)

  if (!flipped) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <BigCall text="TIE!" tone="plain" size="large" />
        <CoinFlip youWin={won} caption={won ? 'It lands on you!' : `It lands on ${players[other(me)].name}`} />
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      {draw ? (
        <BigCall text="TIE" tone="plain" sub="Nobody falls" />
      ) : (
        <BigCall text={won ? 'WON' : 'LOST'} tone={won ? 'win' : 'lose'} sub={result.tie ? 'A tie! The coin flip decided.' : undefined} />
      )}
      <motion.p
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
        className={`flex items-center gap-2 font-display text-xl font-black ${draw ? 'text-gold-light' : won ? 'text-gold' : 'text-red-400'}`}
      >
        {icon && <img src={icon} alt="" className="size-8 object-contain" />}
        {prize}
      </motion.p>
      {Reveal && settled && <Reveal setup={setup} me={me} moves={event.moves} settled={settled} players={players} />}
      <div className="grid w-full max-w-sm grid-cols-2 gap-4">
        <ScoreBox label="You" value={rules.formatScore(result.scores[mySide], setup)} highlight={won && !draw} you />
        <ScoreBox label={players[other(me)].name} value={rules.formatScore(result.scores[theirSide], setup)} highlight={!won && !draw} you={false} />
      </div>
      <EmoteBar onEmote={sendEmote} />
    </div>
  )
}

function ScoreBox({ label, value, highlight, you }: { label: string; value: string; highlight: boolean; you: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col rounded-lg border p-2 ${highlight ? 'border-gold bg-gold/10' : 'border-gold/20'}`}>
      <span className={`text-xs font-semibold [overflow-wrap:anywhere] ${you ? 'text-hextech' : 'text-red-400'}`}>{label}</span>
      <span className={`font-display text-xl font-black ${highlight ? 'text-gold' : 'text-gold-light/70'}`}>{value}</span>
    </div>
  )
}
