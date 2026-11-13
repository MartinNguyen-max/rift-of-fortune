import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { spellIconUrl } from '../../data'
import {
  enemyResults,
  EXECUTE,
  executeScore,
  executeWave,
  finalScores,
  MISSED,
  type EnemyResult,
  type ExecuteEnemy,
  type ExecuteScore,
} from '../../game/minigames/execute'
import { other, withMove, type Moves, type Player } from '../../game/minigames/versus'
import { callOf, mergedMoves, spotPosition } from './executeScreen'
import { GetReady } from './GetReady'
import { championIconById } from './miniGameArt'
import { BigCall, ContestantTag, Waiting } from './parts'
import { useShownWhen, useTimeout } from './timing'
import type { Contestant, MiniGameViewProps, TutorialArtProps } from './types'

/** Darius's ult, Noxian Guillotine. */
const GUILLOTINE = spellIconUrl('DariusExecute.png')
/** How long the last call and the final scores stay up before Victory or Defeat. */
const LAST_CALL_MS = 2800

/** Darius vs Draven: five low-health enemies pop up one by one. Tap each before it escapes. */
export function ExecuteGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const wave = useMemo(() => executeWave(setup.seed), [setup.seed])
  /** Your moves at once, before they come back in `moves`. */
  const [sent, setSent] = useState<Moves>([])
  const mine = useMemo(() => enemyResults(mergedMoves(moves[me], sent), wave), [moves, me, sent, wave])
  const next = mine.length
  const done = next >= wave.length
  /** Theirs only as far as you got, so you never see an enemy's fate before you met it. */
  const theirs = useMemo(() => enemyResults(moves[them], wave).slice(0, next), [moves, them, wave, next])
  const final = useMemo(() => finalScores(moves, setup.seed), [moves, setup.seed])
  useShownWhen(final !== null, onShown, LAST_CALL_MS)

  // A player who comes back mid-wave (reload) goes on from the next enemy after a new 3-2-1.
  const [started, setStarted] = useState(false)
  const start = useCallback(() => setStarted(true), [])

  const strike = useCallback(
    (value: number) => {
      setSent((current) => withMove(current, next, value))
      sendMove(next, value)
    },
    [sendMove, next],
  )

  const last = mine[next - 1]
  const call = last ? callOf(last, mine[next - 2]) : null
  const enemy = wave[next]

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ContestantTag contestant={players[me]} you value={`${executeScore(mine).points}`} />
        <KillPips mine={mine} theirs={theirs} current={done ? -1 : next} />
        <ContestantTag contestant={players[them]} you={false} value={`${executeScore(theirs).points}`} />
      </div>

      <div className="flex h-24 w-full items-center justify-center">
        {!started && !done ? (
          <GetReady onGo={start} />
        ) : (
          call && <BigCall key={next} text={call.text} tone={call.tone} sub={call.sub} size="large" />
        )}
      </div>

      <div className="relative h-72 w-full touch-manipulation overflow-hidden rounded-lg border-2 border-red-900/80 bg-[radial-gradient(circle_at_50%_40%,rgb(120_20_20/0.45),rgb(1_10_19/0.95)_75%)] select-none sm:h-80">
        <Spots />
        {last && wave[next - 1] && <Aftermath key={next - 1} enemy={wave[next - 1] as ExecuteEnemy} result={last} />}
        {started && enemy && <Hunt key={next} enemy={enemy} onResult={strike} />}
        {done && <WaveSummary mine={executeScore(mine)} final={final} me={me} players={players} />}
      </div>

      {done && !final ? <Waiting name={players[them].name} /> : <p className="text-sm text-gold-light/60">Tap the enemy before it escapes!</p>}
    </div>
  )
}

/** One dot per enemy for each player: gold for a kill, red for an escape. */
function KillPips({ mine, theirs, current }: { mine: EnemyResult[]; theirs: EnemyResult[]; current: number }) {
  const row = (results: EnemyResult[], you: boolean) => (
    <div className="flex gap-1">
      {Array.from({ length: EXECUTE.enemies }, (_, index) => {
        const result = results[index]
        const color = result
          ? result.kill
            ? 'border-gold bg-gold'
            : 'border-red-400 bg-red-400/30'
          : you && index === current
            ? 'border-hextech'
            : 'border-gold/30'
        return <span key={index} className={`size-2.5 rounded-full border-2 sm:size-3 ${color}`} />
      })}
    </div>
  )
  return (
    <div className="flex flex-col items-center gap-1" aria-label={`${mine.filter(({ kill }) => kill).length} kills`}>
      {row(mine, true)}
      {row(theirs, false)}
    </div>
  )
}

/** Faint marks where enemies can show up. */
function Spots() {
  return (
    <>
      {Array.from({ length: EXECUTE.columns * EXECUTE.rows }, (_, spot) => (
        <span
          key={spot}
          className="absolute size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-red-300/15 sm:size-16"
          style={spotPosition(spot)}
          aria-hidden="true"
        />
      ))}
    </>
  )
}

/** One enemy: the wait, then up for a moment. A tap on it executes it; a tap beside it whiffs. */
function Hunt({ enemy, onResult }: { enemy: ExecuteEnemy; onResult: (move: number) => void }) {
  const [up, setUp] = useState(false)
  const shownAt = useRef<number | null>(null)
  const finished = useRef(false)
  const finish = useCallback(
    (move: number) => {
      if (finished.current) return
      finished.current = true
      onResult(move)
    },
    [onResult],
  )
  useTimeout(() => setUp(true), enemy.gapMs)
  useEffect(() => {
    if (up) shownAt.current = performance.now()
  }, [up])
  useTimeout(() => finish(MISSED), enemy.windowMs, up)

  const strike = () => {
    if (shownAt.current !== null) finish(Math.round(performance.now() - shownAt.current))
  }
  const whiff = () => {
    if (up) finish(MISSED)
  }

  return (
    <>
      <div className="absolute inset-0" onPointerDown={whiff} aria-hidden="true" />
      {up && (
        <button
          type="button"
          aria-label={`Execute ${enemy.champion}`}
          onPointerDown={strike}
          className="absolute z-10 flex size-24 -translate-x-1/2 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-full"
          style={spotPosition(enemy.spot)}
        >
          <motion.span
            initial={{ scale: 0.7 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.06 }}
            className="relative flex flex-col items-center"
          >
            <TimeRing ms={enemy.windowMs} />
            <img
              src={championIconById(enemy.champion)}
              alt=""
              draggable={false}
              className="size-16 rounded-full border-2 border-red-500 shadow-[0_0_18px_rgb(239_68_68/0.8)] sm:size-[4.5rem]"
            />
            <span className="mt-1 h-1.5 w-14 overflow-hidden rounded-full bg-abyss ring-1 ring-black">
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 0.3, repeat: Infinity }}
                className="block h-full w-[14%] bg-red-500"
              />
            </span>
          </motion.span>
        </button>
      )}
    </>
  )
}

/** A ring around the enemy that runs out with its time. */
function TimeRing({ ms }: { ms: number }) {
  const radius = 46
  const length = 2 * Math.PI * radius
  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute -top-2 left-1/2 size-20 -translate-x-1/2 -rotate-90 sm:size-[5.5rem]" aria-hidden="true">
      <motion.circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        strokeWidth="5"
        className="stroke-gold"
        strokeDasharray={length}
        initial={{ strokeDashoffset: 0 }}
        animate={{ strokeDashoffset: length }}
        transition={{ duration: ms / 1000, ease: 'linear' }}
      />
    </svg>
  )
}

/** The enemy just played: dunked by the Guillotine, or gone. */
function Aftermath({ enemy, result }: { enemy: ExecuteEnemy; result: EnemyResult }) {
  return (
    <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={spotPosition(enemy.spot)} aria-hidden="true">
      {result.kill ? (
        <div className="relative">
          <motion.img
            src={championIconById(enemy.champion)}
            alt=""
            initial={{ opacity: 1, filter: 'grayscale(0)' }}
            animate={{ opacity: 0, filter: 'grayscale(1)', scale: 0.8 }}
            transition={{ duration: 0.9, delay: 0.15 }}
            className="size-16 rounded-full border-2 border-red-500 sm:size-[4.5rem]"
          />
          <motion.img
            src={GUILLOTINE}
            alt=""
            initial={{ y: -70, rotate: -40, opacity: 1 }}
            animate={{ y: 0, rotate: 0, opacity: [1, 1, 0] }}
            transition={{ duration: 0.7, times: [0, 0.3, 1] }}
            className="absolute inset-0 m-auto size-12 rounded-md border-2 border-gold shadow-lg shadow-black"
          />
          <motion.span
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: -34, opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute -top-2 left-1/2 -translate-x-1/2 font-display text-2xl font-black text-gold"
          >
            +{result.streak}
          </motion.span>
        </div>
      ) : (
        <motion.img
          src={championIconById(enemy.champion)}
          alt=""
          initial={{ opacity: 0.9, scale: 1 }}
          animate={{ opacity: 0, scale: 0.4, y: 30 }}
          transition={{ duration: 0.4 }}
          className="size-16 rounded-full border-2 border-red-500 grayscale sm:size-[4.5rem]"
        />
      )}
    </div>
  )
}

interface WaveSummaryProps {
  mine: ExecuteScore
  /** Both scores once the opponent is done too. */
  final: [ExecuteScore, ExecuteScore] | null
  me: Player
  players: readonly [Contestant, Contestant]
}

/** After your fifth enemy: your kills and points, then both side by side. */
function WaveSummary({ mine, final, me, players }: WaveSummaryProps) {
  const theirs = final?.[other(me)]
  const samePoints = theirs !== undefined && theirs.points === mine.points
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.6 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-abyss/75 p-3 text-center backdrop-blur-[2px]"
    >
      <div className="grid w-full max-w-xs grid-cols-[1fr_auto_1fr] items-center gap-3">
        <ScoreSide contestant={players[me]} score={mine} you best={theirs !== undefined && mine.points > theirs.points} />
        <span className="font-display text-lg text-gold/60">vs</span>
        {theirs ? (
          <ScoreSide contestant={players[other(me)]} score={theirs} you={false} best={theirs.points > mine.points} />
        ) : (
          <span className="text-3xl text-gold-light/40">?</span>
        )}
      </div>
      {samePoints && <p className="text-xs text-gold-light/70">Same points: more kills, then faster kills win</p>}
    </motion.div>
  )
}

function ScoreSide({ contestant, score, you, best }: { contestant: Contestant; score: ExecuteScore; you: boolean; best: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <img
        src={championIconById(contestant.champion)}
        alt={contestant.name}
        className={`size-12 rounded-full border-2 ${you ? 'border-hextech' : 'border-red-400'}`}
      />
      <span className={`font-display text-4xl font-black tabular-nums ${best ? 'text-gold' : you ? 'text-hextech' : 'text-red-400'}`}>
        {score.points}
      </span>
      <span className="text-xs text-gold-light/70">
        {score.kills} {score.kills === 1 ? 'kill' : 'kills'}
        {score.kills > 0 && ` · ${(score.time / score.kills / 1000).toFixed(2)} s`}
      </span>
    </div>
  )
}

/** 1: an enemy pops up for a moment. 2: tap it, the Guillotine falls. 3: kills in a row score more. */
export function ExecuteTutorialArt({ step }: TutorialArtProps) {
  const backdrop = 'bg-[radial-gradient(circle_at_50%_40%,rgb(120_20_20/0.5),rgb(1_10_19))]'
  if (step === 0) {
    return (
      <div className={`relative size-full ${backdrop}`}>
        {[25, 50, 75].flatMap((left) =>
          [28, 52, 76].map((top) => (
            <span
              key={`${left}-${top}`}
              className="absolute size-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-red-300/25"
              style={{ left: `${left}%`, top: `${top}%` }}
            />
          )),
        )}
        {[
          { left: '25%', top: '28%', delay: 0 },
          { left: '75%', top: '52%', delay: 0.9 },
          { left: '50%', top: '76%', delay: 1.8 },
        ].map(({ left, top, delay }) => (
          <motion.img
            key={left}
            src={championIconById(['Jinx', 'Lux', 'Ezreal'][Math.round(delay / 0.9)] ?? 'Jinx')}
            alt=""
            animate={{ opacity: [0, 1, 1, 0, 0], scale: [0.7, 1, 1, 0.7, 0.7] }}
            transition={{ duration: 2.7, delay, repeat: Infinity, times: [0, 0.04, 0.3, 0.33, 1] }}
            className="absolute size-[32%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500"
            style={{ left, top }}
          />
        ))}
      </div>
    )
  }
  if (step === 1) {
    return (
      <div className={`relative flex size-full items-center justify-center ${backdrop}`}>
        <img src={championIconById('Lux')} alt="" className="size-[42%] rounded-full border-2 border-red-500" />
        <motion.img
          src={GUILLOTINE}
          alt=""
          animate={{ y: ['-120%', '0%', '0%'], rotate: [-40, 0, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, times: [0, 0.3, 1] }}
          className="absolute size-[30%] rounded border border-gold"
        />
        <motion.span
          animate={{ scale: [1, 0.85, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="absolute right-[14%] bottom-[8%] text-2xl sm:text-4xl"
        >
          👆
        </motion.span>
      </div>
    )
  }
  return (
    <div className={`flex size-full flex-col items-center justify-center gap-[8%] ${backdrop}`}>
      <div className="flex gap-[6%]">
        {[1, 2, 3, 4, 5].map((points) => (
          <motion.span
            key={points}
            animate={{ scale: [0.6, 1.15, 1] }}
            transition={{ duration: 0.4, delay: points * 0.25, repeat: Infinity, repeatDelay: 1.4 }}
            className="font-display text-xs font-black text-gold sm:text-base"
          >
            +{points}
          </motion.span>
        ))}
      </div>
      <motion.span
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="font-display text-sm font-black text-gold drop-shadow-[0_0_10px_rgb(200_170_110/0.8)] sm:text-xl"
      >
        PENTAKILL
      </motion.span>
    </div>
  )
}
