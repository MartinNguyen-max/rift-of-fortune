import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { spellIconUrl } from '../../data'
import {
  checkCombo,
  COMBO_KEYS,
  COMBO_MAX_LENGTH,
  COMBO_RULES,
  COMBO_START_LENGTH,
  comboCheer,
  comboSpam,
  FIRST_KEY_FACTOR,
  flashSeconds,
  inputSeconds,
  liveCombos,
  rightKeys,
  type ComboKey,
} from '../../game/minigames/combo'
import { other, type GameSetup, type Player, type Settled } from '../../game/minigames/versus'
import { liveScore, useComboKeys } from './comboScreen'
import { GetReady } from './GetReady'
import { championIconById } from './miniGameArt'
import { BigCall, ChoiceTimer, ContestantTag, Waiting } from './parts'
import { useShownWhen, useTimeout } from './timing'
import type { Contestant, MiniGameViewProps, TutorialArtProps } from './types'

const SPELLS: Record<ComboKey, { name: string; icon: string; color: string }> = {
  Q: { name: 'Wilding Claw', icon: 'UdyrQ.png', color: 'border-red-400 shadow-red-500/50' },
  W: { name: 'Iron Mantle', icon: 'UdyrW.png', color: 'border-sky-300 shadow-sky-400/50' },
  E: { name: 'Blazing Stampede', icon: 'UdyrE.png', color: 'border-orange-300 shadow-orange-400/50' },
  R: { name: 'Wingborne Storm', icon: 'UdyrR.png', color: 'border-cyan-200 shadow-cyan-300/50' },
}

/** "Watch Udyr!" stays up this long before each spam, so nobody misses the start. */
const WATCH_SECONDS = 1.2
/** Pause between two flashed keys, so the same key twice in a row can be seen. */
const GAP_SECONDS = 0.14
/** Solo: the cheer between two rounds. */
const CHEER_SECONDS = 1.3
/** Multiplayer: how long a spam's right and wrong keys stay up before the next spam. */
const ROUND_RESULT_SECONDS = 1.5
/** The last call and both scores stay up this long before the result covers the game. */
const FINAL_MOMENT_MS = 2600

/** Udyr Has No Combo: Simon with Q, W, E and R. Solo grows one spam; Multiplayer plays three new ones. */
export function ComboGame(props: MiniGameViewProps) {
  return props.setup.variant === 'solo' ? <SoloCombo {...props} /> : <LiveCombo {...props} />
}

type SoloStage = 'ready' | 'watch' | 'input' | 'cheer' | 'over'
type SoloEnd = 'wrong' | 'slow' | 'beat'

/** One spam that grows by a key each round, until a wrong key, the clock, or beating the bot's best. */
function SoloCombo({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const spam = useMemo(() => comboSpam(setup.seed), [setup.seed])
  // Known from the start; only shown once you pass it.
  const botBest = moves[them][0] ?? COMBO_MAX_LENGTH
  const [stage, setStage] = useState<SoloStage>('ready')
  const [length, setLength] = useState(COMBO_START_LENGTH)
  const [typed, setTyped] = useState<ComboKey[]>([])
  const [end, setEnd] = useState<SoloEnd | null>(null)
  const settled = COMBO_RULES.settle(moves, setup)
  useShownWhen(settled !== null, onShown, FINAL_MOMENT_MS)

  const typing = stage === 'input' && moves[me][0] === undefined
  const completed = length > COMBO_START_LENGTH ? length - 1 : 0

  const finish = useCallback(
    (reason: SoloEnd, keys: number) => {
      setEnd(reason)
      setStage('over')
      sendMove(0, keys)
    },
    [sendMove],
  )

  const press = useCallback(
    (key: ComboKey) => {
      if (!typing) return
      const next = [...typed, key]
      setTyped(next)
      const check = checkCombo(spam, length, next)
      if (check === 'wrong') finish('wrong', completed)
      else if (check === 'complete') {
        if (length > botBest || length >= COMBO_MAX_LENGTH) finish('beat', length)
        else setStage('cheer')
      }
    },
    [typing, typed, spam, length, completed, botBest, finish],
  )

  useTimeout(
    () => {
      setLength(length + 1)
      setTyped([])
      setStage('watch')
    },
    CHEER_SECONDS * 1000,
    stage === 'cheer',
  )
  const watch = useCallback(() => setStage('watch'), [])
  const type = useCallback(() => setStage('input'), [])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between gap-3">
        <SpamLength you={players[me]} length={length} />
        <BotStatus bot={players[them]} botBest={botBest} length={length} />
      </div>

      <div className="flex min-h-52 w-full flex-col items-center justify-center gap-3">
        {stage === 'ready' && <GetReady onGo={watch} />}
        {stage === 'watch' && <Flasher key={length} keys={spam.slice(0, length)} onDone={type} />}
        {stage === 'input' && (
          <ChoiceTimer key={length} seconds={inputSeconds(length)} onTimeout={() => finish('slow', completed)} label="Your turn" />
        )}
        {stage === 'cheer' && <BigCall text={`Combo x${length}!`} tone="win" size="large" sub={comboCheer(length)} />}
        {end && <SoloEndCall end={end} length={length} />}
        {(stage === 'input' || stage === 'over') && <TypedKeys spam={spam} length={length} typed={typed} judged={stage === 'over'} />}
      </div>

      {settled ? <FinalScores settled={settled} me={me} players={players} setup={setup} /> : <KeyPad enabled={typing} onPress={press} />}
    </div>
  )
}

function SoloEndCall({ end, length }: { end: SoloEnd; length: number }) {
  if (end === 'beat') return <BigCall text={`Combo x${length}!`} tone="win" size="large" />
  return <BigCall text={end === 'wrong' ? 'Wrong key!' : 'Too slow!'} tone="lose" size="large" />
}

function SpamLength({ you, length }: { you: Contestant; length: number }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <img src={championIconById(you.champion)} alt="" className="size-9 rounded-full border-2 border-hextech" />
      <span className="flex flex-col leading-tight">
        <span className="text-xs tracking-wider text-gold-light/60 uppercase">Spam</span>
        <motion.span
          key={length}
          initial={{ scale: 1.5 }}
          animate={{ scale: 1 }}
          className="font-display text-2xl leading-none font-black text-gold"
        >
          {length}
        </motion.span>
      </span>
    </div>
  )
}

function BotStatus({ bot, botBest, length }: { bot: Contestant; botBest: number; length: number }) {
  const out = length > botBest
  return (
    <div className="flex min-w-0 items-center gap-2 text-right text-sm" aria-live="polite">
      <span className={`[overflow-wrap:anywhere] ${out ? 'font-semibold text-red-400' : 'text-gold-light/70'}`}>
        {out ? `${bot.name} fat-fingered at ${botBest + 1}!` : `${bot.name}: still spamming...`}
      </span>
      <img
        src={championIconById(bot.champion)}
        alt=""
        className={`size-9 shrink-0 rounded-full border-2 border-red-400 ${out ? 'grayscale' : ''}`}
      />
    </div>
  )
}

type LiveStage = 'ready' | 'watch' | 'input' | 'result'

/** Multiplayer: three new spams of 3, 4 and 5 keys. A wrong key doesn't end it: every right key counts. */
function LiveCombo({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const spams = useMemo(() => liveCombos(setup.seed), [setup.seed])
  const [round, setRound] = useState(0)
  const [stage, setStage] = useState<LiveStage>('ready')
  const [typed, setTyped] = useState<ComboKey[][]>(() => spams.map(() => []))
  const settled = COMBO_RULES.settle(moves, setup)
  useShownWhen(settled !== null, onShown, FINAL_MOMENT_MS)

  // Sent by you, or filled in by the host when you were too slow: either way your game is over.
  const sent = moves[me][0] !== undefined
  const spam = spams[round] ?? []
  const roundTyped = typed[round] ?? []
  const lastRound = round >= spams.length - 1
  const typing = stage === 'input' && !sent
  const judged = stage === 'result' || (sent && stage === 'input')
  const judgedRounds = judged ? round + 1 : round

  const endRound = useCallback(
    (allTyped: readonly ComboKey[][]) => {
      setStage('result')
      if (lastRound) sendMove(0, liveScore(spams, allTyped))
    },
    [lastRound, sendMove, spams],
  )

  const press = useCallback(
    (key: ComboKey) => {
      const length = spams[round]?.length ?? 0
      const before = typed[round]?.length ?? 0
      if (!typing || before >= length) return
      const next = typed.map((keys, index) => (index === round ? [...keys, key] : keys))
      setTyped(next)
      if (before + 1 >= length) endRound(next)
    },
    [typing, spams, typed, round, endRound],
  )

  useTimeout(
    () => {
      setRound(round + 1)
      setStage('watch')
    },
    ROUND_RESULT_SECONDS * 1000,
    stage === 'result' && !lastRound && !sent,
  )
  const watch = useCallback(() => setStage('watch'), [])
  const type = useCallback(() => setStage('input'), [])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ContestantTag contestant={players[me]} you value={`${liveScore(spams.slice(0, judgedRounds), typed)}`} />
        <SpamChips spams={spams} typed={typed} round={round} judgedRounds={judgedRounds} />
        <ContestantTag contestant={players[them]} you={false} value={settled ? `${settled.scores[them]}` : '?'} />
      </div>

      <div className="flex min-h-52 w-full flex-col items-center justify-center gap-3">
        {judged ? (
          <RoundResult spam={spam} typed={roundTyped} />
        ) : sent ? null : stage === 'ready' ? (
          <GetReady onGo={watch} />
        ) : stage === 'watch' ? (
          <Flasher key={round} keys={spam} onDone={type} />
        ) : (
          <>
            <ChoiceTimer key={round} seconds={inputSeconds(spam.length)} onTimeout={() => endRound(typed)} label="Your turn" />
            <TypedKeys spam={spam} length={spam.length} typed={roundTyped} judged={false} />
          </>
        )}
      </div>

      {settled ? (
        <FinalScores settled={settled} me={me} players={players} setup={setup} />
      ) : sent ? (
        <Waiting name={players[them].name} />
      ) : (
        <KeyPad enabled={typing} onPress={press} />
      )}
    </div>
  )
}

/** One spam's score, big, over the keys you typed: right ones green, wrong ones red. */
function RoundResult({ spam, typed }: { spam: readonly ComboKey[]; typed: readonly ComboKey[] }) {
  const right = rightKeys(spam, typed)
  return (
    <>
      <BigCall text={`${right}/${spam.length}`} tone={right === spam.length ? 'win' : 'plain'} size="large" />
      <TypedKeys spam={spam} length={spam.length} typed={typed} judged />
    </>
  )
}

interface SpamChipsProps {
  spams: readonly (readonly ComboKey[])[]
  typed: readonly (readonly ComboKey[])[]
  round: number
  /** Spams whose score is shown. */
  judgedRounds: number
}

/** The three spams: right keys once played, the length before. */
function SpamChips({ spams, typed, round, judgedRounds }: SpamChipsProps) {
  return (
    <div className="flex items-center gap-1">
      {spams.map((spam, index) => {
        const judged = index < judgedRounds
        const right = rightKeys(spam, typed[index] ?? [])
        const look = judged
          ? right === spam.length
            ? 'border-emerald-400 text-emerald-300'
            : 'border-gold text-gold-light'
          : index === round
            ? 'border-hextech text-hextech'
            : 'border-gold/25 text-gold-light/40'
        return (
          <span key={index} className={`rounded-md border-2 px-1.5 py-0.5 font-display text-sm font-black tabular-nums ${look}`}>
            {judged ? `${right}/${spam.length}` : spam.length}
          </span>
        )
      })}
    </div>
  )
}

/** Flashes the spam one key at a time, the first one a little longer, then hands over to you. */
function Flasher({ keys, onDone }: { keys: readonly ComboKey[]; onDone: () => void }) {
  /** -1 while Udyr winds up, then the key on screen. */
  const [index, setIndex] = useState(-1)
  const [visible, setVisible] = useState(false)
  const flash = flashSeconds(keys.length)

  useEffect(() => {
    const shown = index === 0 ? flash * FIRST_KEY_FACTOR : flash
    const delay = index === -1 ? WATCH_SECONDS : visible ? shown : GAP_SECONDS
    const id = window.setTimeout(() => {
      if (visible) setVisible(false)
      else if (index + 1 >= keys.length) onDone()
      else {
        setIndex(index + 1)
        setVisible(true)
      }
    }, delay * 1000)
    return () => window.clearTimeout(id)
  }, [index, visible, flash, keys.length, onDone])

  const spell = keys[index]
  const windingUp = index === -1
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <motion.img
          src={championIconById('Udyr')}
          alt=""
          animate={windingUp ? { scale: [1, 1.18, 1] } : { scale: 1 }}
          transition={windingUp ? { duration: 0.6, repeat: Infinity } : { duration: 0.2 }}
          className="size-10 rounded-full border-2 border-gold/70"
        />
        <p className="font-display text-xl font-black text-gold-light">Watch Udyr!</p>
      </div>
      <div className="flex size-24 items-center justify-center">
        <AnimatePresence>{visible && spell && <SpellFlash key={index} spell={spell} />}</AnimatePresence>
      </div>
      <Dots total={keys.length} filled={index + 1} />
    </div>
  )
}

function SpellFlash({ spell }: { spell: ComboKey }) {
  return (
    <motion.div
      initial={{ scale: 0.4, opacity: 0, rotate: -10 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      exit={{ scale: 1.3, opacity: 0 }}
      transition={{ duration: 0.12 }}
      className={`relative overflow-hidden rounded-xl border-4 shadow-lg ${SPELLS[spell].color}`}
    >
      <img src={spellIconUrl(SPELLS[spell].icon)} alt={spell} className="size-24" draggable={false} />
      <span className="absolute right-1 bottom-0 font-display text-3xl font-black text-white drop-shadow-[0_2px_3px_black]">{spell}</span>
    </motion.div>
  )
}

function Dots({ total, filled }: { total: number; filled: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={`size-2 rounded-full ${index < filled ? 'bg-gold' : 'bg-gold/20'}`} />
      ))}
    </div>
  )
}

interface TypedKeysProps {
  spam: readonly ComboKey[]
  length: number
  typed: readonly ComboKey[]
  /** Right keys green, wrong ones red (with the right key), missed ones show the right key faded. */
  judged: boolean
}

function TypedKeys({ spam, length, typed, judged }: TypedKeysProps) {
  return (
    <div className="flex max-w-full flex-wrap justify-center gap-1.5">
      {Array.from({ length }, (_, index) => (
        <KeyBox key={index} typed={typed[index]} answer={spam[index]} judged={judged} order={index} />
      ))}
    </div>
  )
}

interface KeyBoxProps {
  typed: ComboKey | undefined
  answer: ComboKey | undefined
  judged: boolean
  /** Its place in the row, so judging sweeps from left to right. */
  order: number
}

function KeyBox({ typed, answer, judged, order }: KeyBoxProps) {
  const right = typed !== undefined && typed === answer
  const look = !judged
    ? typed
      ? 'border-gold bg-gold/10 text-gold-light'
      : 'border-dashed border-gold/25 text-transparent'
    : right
      ? 'border-emerald-400 bg-emerald-400/15 text-emerald-300'
      : typed
        ? 'border-red-400 bg-red-500/20 text-red-300'
        : 'border-dashed border-red-400/50 text-gold-light/35'
  return (
    <span
      className={`relative flex size-9 items-center justify-center rounded border-2 font-display text-lg font-black transition-colors duration-300 ${look}`}
      style={{ transitionDelay: judged ? `${order * 70}ms` : '0ms' }}
    >
      <motion.span key={typed ?? 'empty'} initial={{ scale: typed ? 1.6 : 1 }} animate={{ scale: 1 }}>
        {typed ?? (judged ? answer : '·')}
      </motion.span>
      {judged && typed && !right && (
        <span className="absolute -right-1.5 -bottom-1.5 rounded bg-abyss px-0.5 text-[10px] leading-tight text-emerald-300">{answer}</span>
      )}
    </span>
  )
}

/** Q W E R as big tap buttons with Udyr's spell icons, and the same keys on a keyboard. */
function KeyPad({ enabled, onPress }: { enabled: boolean; onPress: (key: ComboKey) => void }) {
  const [pressed, setPressed] = useState<{ key: ComboKey; count: number } | null>(null)
  const press = useCallback(
    (key: ComboKey) => {
      if (!enabled) return
      setPressed((last) => ({ key, count: (last?.count ?? 0) + 1 }))
      onPress(key)
    },
    [enabled, onPress],
  )
  useComboKeys(press, enabled)

  return (
    <div className="grid w-full max-w-md grid-cols-4 gap-2 sm:gap-3">
      {COMBO_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          disabled={!enabled}
          onPointerDown={() => press(key)}
          // A keyboard "click" (Enter or Space on a focused button) has no pointer down.
          onClick={(event) => {
            if (event.detail === 0) press(key)
          }}
          aria-label={`${key}: ${SPELLS[key].name}`}
          className="relative flex touch-manipulation flex-col items-center gap-1 rounded-lg border-2 border-gold/50 bg-abyss/60 p-2 transition-[scale,border-color,opacity] select-none enabled:hover:border-gold enabled:active:scale-95 disabled:opacity-40"
        >
          {pressed?.key === key && (
            <motion.span
              key={pressed.count}
              initial={{ opacity: 1, scale: 0.92 }}
              animate={{ opacity: 0, scale: 1.12 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-none absolute inset-0 rounded-lg border-2 border-hextech bg-hextech/25"
              aria-hidden="true"
            />
          )}
          <img src={spellIconUrl(SPELLS[key].icon)} alt="" className="size-12 rounded sm:size-14" draggable={false} />
          <span className="font-display text-xl font-black text-gold-light">{key}</span>
        </button>
      ))}
    </div>
  )
}

interface FinalScoresProps {
  settled: Settled
  me: Player
  players: readonly [Contestant, Contestant]
  setup: GameSetup
}

/** Both scores side by side, the winner's in gold. */
function FinalScores({ settled, me, players, setup }: FinalScoresProps) {
  const them = other(me)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="flex w-full max-w-sm items-start justify-center gap-4"
      aria-live="polite"
    >
      <Tally contestant={players[me]} you value={COMBO_RULES.formatScore(settled.scores[me], setup)} won={settled.winner === me} />
      <span className="self-center font-display text-sm font-bold text-gold-light/50">VS</span>
      <Tally
        contestant={players[them]}
        you={false}
        value={COMBO_RULES.formatScore(settled.scores[them], setup)}
        won={settled.winner === them}
      />
    </motion.div>
  )
}

function Tally({ contestant, you, value, won }: { contestant: Contestant; you: boolean; value: string; won: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
      <img
        src={championIconById(contestant.champion)}
        alt=""
        className={`size-10 rounded-full border-2 ${you ? 'border-hextech' : 'border-red-400'}`}
      />
      <span className={`text-xs font-semibold [overflow-wrap:anywhere] ${you ? 'text-hextech' : 'text-red-400'}`}>{contestant.name}</span>
      <motion.span
        initial={{ scale: 0.6 }}
        animate={{ scale: won ? 1.15 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.5 }}
        className={`font-display text-xl font-black ${won ? 'text-gold drop-shadow-[0_0_10px_rgb(200_170_110/0.7)]' : 'text-gold-light/60'}`}
      >
        {value}
      </motion.span>
    </div>
  )
}

/** 1: Udyr flashes a spell. 2: Q W E R, pressed in turn. 3: the spam grows, 3, 4 then 5 keys. */
export function ComboTutorialArt({ step }: TutorialArtProps) {
  if (step === 0) return <WatchArt />
  if (step === 1) return <KeyCapsArt />
  return <GrowingSpamArt />
}

function WatchArt() {
  return (
    <div className="relative flex size-full items-center justify-center">
      <img src={championIconById('Udyr')} alt="" className="absolute bottom-1.5 left-1.5 size-1/3 rounded-full border-2 border-gold/70" />
      <motion.div
        animate={{ scale: [0.5, 1, 1, 0.5], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.6, times: [0, 0.15, 0.75, 1], repeat: Infinity }}
        className={`relative size-1/2 overflow-hidden rounded-lg border-4 shadow-lg ${SPELLS.E.color}`}
      >
        <img src={spellIconUrl(SPELLS.E.icon)} alt="" className="size-full" />
        <span className="absolute right-0.5 bottom-0 font-display text-lg leading-tight font-black text-white drop-shadow-[0_1px_2px_black]">
          E
        </span>
      </motion.div>
    </div>
  )
}

function KeyCapsArt() {
  return (
    <div className="grid size-full grid-cols-2 place-items-center gap-1.5 p-2.5">
      {COMBO_KEYS.map((key, index) => (
        <motion.span
          key={key}
          animate={{ y: [0, 3, 0] }}
          transition={{ duration: 0.4, delay: index * 0.5, repeat: Infinity, repeatDelay: 1.6 }}
          className="relative flex aspect-square w-full items-center justify-center rounded-md border-2 border-b-4 border-gold/60 bg-abyss font-display text-lg font-black text-gold-light"
        >
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.4, delay: index * 0.5, repeat: Infinity, repeatDelay: 1.6 }}
            className="absolute inset-0 rounded-sm bg-hextech/40"
          />
          <span className="relative">{key}</span>
        </motion.span>
      ))}
    </div>
  )
}

function GrowingSpamArt() {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-1.5">
      {[3, 4, 5].map((count) => (
        <div key={count} className="flex w-full justify-center gap-1">
          {Array.from({ length: count }, (_, index) =>
            index === count - 1 ? (
              <motion.span
                key={index}
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 1, repeat: Infinity, delay: count * 0.2 }}
                className="aspect-square w-[13%] rounded-sm border-2 border-hextech bg-hextech/40"
              />
            ) : (
              <span key={index} className="aspect-square w-[13%] rounded-sm border-2 border-gold bg-gold/30" />
            ),
          )}
        </div>
      ))}
    </div>
  )
}
