import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState, type PointerEvent, type ReactNode } from 'react'
import { spellIconUrl } from '../../data'
import {
  finalWalls,
  landsAt,
  NO_WALL,
  readWall,
  shotResult,
  shotResults,
  WIND_WALL,
  wallMove,
  wallScore,
  windWallVolley,
  type Shot,
  type ShotResult,
  type Side,
  type WallScore,
} from '../../game/minigames/windwall'
import { other, withMove, type Moves, type Player } from '../../game/minigames/versus'
import { GetReady } from './GetReady'
import { championIconById } from './miniGameArt'
import { BigCall, ContestantTag, Waiting } from './parts'
import { useShownWhen } from './timing'
import type { Contestant, MiniGameViewProps, TutorialArtProps } from './types'
import { useStopwatch } from './useStopwatch'
import { alongPath, CENTER, edgePoint, mergedMoves, sideFromPoint, sideOfKey, WALL_AT, wallCall } from './windWallScreen'

/** Yasuo's Wind Wall. */
const WIND_WALL_ICON = spellIconUrl('YasuoW.png')
/** The quiet moment before the first warning (or the next one, after a reload). */
const LEAD_MS = 700
/** How long a wall stays up on screen. */
const WALL_SHOWN_MS = 450
/** How long the last call and both scores stay up before Victory or Defeat. */
const LAST_CALL_MS = 2600

const at = ({ x, y }: { x: number; y: number }) => ({ left: `${x}%`, top: `${y}%` })

/** Yasuo vs Yone: skillshots from every side. Tap the side a shot comes from to wall it. */
export function WindWallGame({ setup, me, moves, sendMove, onShown, players }: MiniGameViewProps) {
  const them = other(me)
  const volley = useMemo(() => windWallVolley(setup.seed), [setup.seed])
  /** Your moves at once, before they come back in `moves`. */
  const [sent, setSent] = useState<Moves>([])
  const myMoves = useMemo(() => mergedMoves(moves[me], sent), [moves, me, sent])
  const mine = useMemo(() => shotResults(myMoves, volley), [myMoves, volley])
  const answered = mine.length
  const done = answered >= volley.length
  /** Theirs only as far as you got, so you never see a shot's fate before you faced it. */
  const theirs = useMemo(() => shotResults(moves[them], volley).slice(0, answered), [moves, them, volley, answered])
  const final = useMemo(() => finalWalls(moves, setup.seed), [moves, setup.seed])
  useShownWhen(final !== null, onShown, LAST_CALL_MS)

  /** The shot the volley starts at: 0, or the next one for a player who came back mid-volley. */
  const [startFrom, setStartFrom] = useState<number | null>(null)
  const start = useCallback(() => setStartFrom(answered), [answered])

  const answer = useCallback(
    (step: number, value: number) => {
      setSent((current) => withMove(current, step, value))
      sendMove(step, value)
    },
    [sendMove],
  )

  const last = mine[answered - 1]
  const call = last ? wallCall(last) : null

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ContestantTag contestant={players[me]} you value={`${wallScore(mine).blocked}`} />
        <ShotPips mine={mine} theirs={theirs} current={done ? -1 : answered} />
        <ContestantTag contestant={players[them]} you={false} value={`${wallScore(theirs).blocked}`} />
      </div>

      <div className="flex h-20 w-full items-center justify-center overflow-hidden">
        {startFrom === null && !done ? (
          <GetReady onGo={start} />
        ) : (
          call && <BigCall key={answered} text={call.text} tone={call.tone} sub={call.sub} size="large" />
        )}
      </div>

      <div className="relative aspect-square w-full max-w-sm">
        {startFrom === null ? (
          <Arena champion={players[me].champion} />
        ) : (
          <Volley volley={volley} startFrom={startFrom} myMoves={myMoves} champion={players[me].champion} onAnswer={answer} />
        )}
        {done && <VolleySummary mine={wallScore(mine)} final={final} me={me} players={players} />}
      </div>

      {done && !final ? (
        <Waiting name={players[them].name} />
      ) : (
        <p className="text-center text-sm text-gold-light/60">Tap the side the shot comes from, or use the arrow keys</p>
      )}
    </div>
  )
}

/** One dot per shot for each player: gold for a block, red for a hit. */
function ShotPips({ mine, theirs, current }: { mine: ShotResult[]; theirs: ShotResult[]; current: number }) {
  const row = (results: ShotResult[], you: boolean) => (
    <div className="flex gap-0.5 sm:gap-1">
      {Array.from({ length: WIND_WALL.shots }, (_, index) => {
        const result = results[index]
        const color = result
          ? result.outcome === 'blocked'
            ? 'border-gold bg-gold'
            : 'border-red-400 bg-red-400/30'
          : you && index === current
            ? 'border-hextech'
            : 'border-gold/30'
        return <span key={index} className={`size-2 rounded-full border-2 sm:size-2.5 ${color}`} />
      })}
    </div>
  )
  return (
    <div className="flex flex-col items-center gap-1" aria-label={`${wallScore(mine).blocked} blocked`}>
      {row(mine, true)}
      {row(theirs, false)}
    </div>
  )
}

/** The arena: Yasuo in the middle, the four sides marked. Children are drawn on top. */
interface ArenaProps {
  champion: string
  /** Flash Yasuo: a shot just hit him. */
  hit?: boolean
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void
  children?: ReactNode
}

function Arena({ champion, hit = false, onPointerDown, children }: ArenaProps) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute inset-0 touch-manipulation overflow-hidden rounded-xl border-2 border-hextech/40 bg-[radial-gradient(circle_at_50%_50%,rgb(10_70_90/0.55),rgb(1_10_19/0.95)_72%)] select-none"
    >
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
        <path d="M0 0 L100 100 M100 0 L0 100" stroke="rgb(200 170 110 / 0.12)" strokeWidth="0.5" />
        {([0, 1, 2, 3] as const).map((side) => {
          const { x, y } = edgePoint(side)
          return <circle key={side} cx={x} cy={y} r="7" fill="none" stroke="rgb(248 113 113 / 0.18)" strokeDasharray="2 2" strokeWidth="0.6" />
        })}
      </svg>
      <motion.img
        src={championIconById(champion)}
        alt=""
        draggable={false}
        animate={hit ? { x: [0, -8, 8, -4, 0], filter: ['brightness(1)', 'brightness(2) saturate(0)', 'brightness(1)'] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        className="absolute size-[20%] -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-hextech shadow-[0_0_24px_rgb(10_200_185/0.6)]"
        style={at(CENTER)}
      />
      {children}
    </div>
  )
}

interface VolleyProps {
  volley: readonly Shot[]
  startFrom: number
  myMoves: Moves
  champion: string
  onAnswer: (step: number, value: number) => void
}

/** The volley playing out. A tap or arrow key answers the oldest shot still in the air. */
function Volley({ volley, startFrom, myMoves, champion, onAnswer }: VolleyProps) {
  const lastShot = volley[volley.length - 1]
  const offset = (volley[startFrom]?.warnAt ?? 0) - LEAD_MS
  const answered = shotResults(myMoves, volley).length
  const [finished, setFinished] = useState(false)
  const { seconds, read } = useStopwatch(!finished)
  const now = offset + seconds * 1000
  const target = volley[answered]
  /** A wall put up while no shot was coming: just for show. */
  const [freeWall, setFreeWall] = useState<{ side: Side; at: number } | null>(null)

  // A shot nobody walled lands: that's a hit. Once all are answered, the clock stops after the last one.
  useEffect(() => {
    const until = target ? landsAt(target) : lastShot ? landsAt(lastShot) + 900 : 0
    const id = window.setTimeout(
      () => (target ? onAnswer(answered, NO_WALL) : setFinished(true)),
      Math.max(0, until - (offset + read() * 1000)) + 20,
    )
    return () => window.clearTimeout(id)
  }, [target, answered, lastShot, offset, read, onAnswer])

  const wallUp = useCallback(
    (side: Side) => {
      const time = offset + read() * 1000
      if (target && time >= target.warnAt && time <= landsAt(target)) onAnswer(answered, wallMove(side, time - target.warnAt))
      else setFreeWall({ side, at: time })
    },
    [offset, read, target, answered, onAnswer],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const side = sideOfKey(event.code)
      if (side === null || event.repeat) return
      event.preventDefault()
      wallUp(side)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [wallUp])

  const tap = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    wallUp(sideFromPoint(event.clientX - box.left - box.width / 2, event.clientY - box.top - box.height / 2))
  }

  const walls = volley.flatMap((shot, index) => {
    const move = myMoves[index]
    const wall = move === undefined ? null : readWall(move)
    if (!wall) return []
    const from = shot.warnAt + wall.ms
    const blockAt = shot.warnAt + shot.warnMs + shot.flightMs * WALL_AT
    const until = wall.side === shot.side ? Math.max(from + WALL_SHOWN_MS, blockAt + 250) : from + WALL_SHOWN_MS
    return now >= from && now <= until ? [{ key: `shot-${index}`, side: wall.side }] : []
  })
  if (freeWall && now - freeWall.at <= WALL_SHOWN_MS) walls.push({ key: `free-${freeWall.at}`, side: freeWall.side })
  const hit = volley.some((shot, index) => {
    const move = myMoves[index]
    const blocked = move !== undefined && shotResult(shot, move).outcome === 'blocked'
    return !blocked && now >= landsAt(shot) && now <= landsAt(shot) + 350
  })

  return (
    <Arena champion={champion} hit={hit} onPointerDown={tap}>
      {volley.map((shot, index) =>
        index >= startFrom - 1 && now >= shot.warnAt && now <= landsAt(shot) + 400 ? (
          <ShotOnScreen key={index} shot={shot} now={now} move={myMoves[index]} />
        ) : null,
      )}
      <AnimatePresence>
        {walls.map(({ key, side }) => (
          <WallBar key={key} side={side} />
        ))}
      </AnimatePresence>
    </Arena>
  )
}

/** One shot: the shooter's warning, then the skillshot flying in, stopped by the wall or hitting Yasuo. */
function ShotOnScreen({ shot, now, move }: { shot: Shot; now: number; move: number | undefined }) {
  const fireAt = shot.warnAt + shot.warnMs
  const blocked = move !== undefined && shotResult(shot, move).outcome === 'blocked'
  const flown = Math.min(1, Math.max(0, (now - fireAt) / shot.flightMs))
  const stopped = blocked && flown >= WALL_AT
  const warning = now < fireAt
  const edge = edgePoint(shot.side)
  return (
    <>
      <motion.div
        className="pointer-events-none absolute flex size-[15%] -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        style={at(edge)}
        animate={warning ? { scale: [1, 1.15, 1] } : { scale: 1, opacity: now > landsAt(shot) ? 0.3 : 1 }}
        transition={warning ? { duration: 0.25, repeat: Infinity } : { duration: 0.2 }}
      >
        <img
          src={championIconById(shot.shooter)}
          alt=""
          draggable={false}
          className={`size-full rounded-full border-2 ${warning ? 'border-red-500 shadow-[0_0_18px_rgb(239_68_68/0.9)]' : 'border-red-400/60'}`}
        />
        {warning && <span className="absolute -top-1 -right-1 rounded-full bg-red-600 px-1 font-display text-xs font-black text-white">!</span>}
      </motion.div>
      {warning && <WarningLine side={shot.side} />}
      {!warning && !stopped && flown < 1 && (
        <img
          src={spellIconUrl(shot.spell)}
          alt=""
          draggable={false}
          className="pointer-events-none absolute size-[10%] -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-orange-300 shadow-[0_0_14px_rgb(253_186_116/0.9)]"
          style={at(alongPath(shot.side, flown))}
        />
      )}
      {stopped && (
        <motion.span
          initial={{ scale: 0.3, opacity: 1 }}
          animate={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="pointer-events-none absolute size-[12%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-200/70"
          style={at(alongPath(shot.side, WALL_AT))}
        />
      )}
    </>
  )
}

/** A faint red line from the shooter toward Yasuo while the shot is being aimed. */
function WarningLine({ side }: { side: Side }) {
  const from = alongPath(side, 0.12)
  const to = alongPath(side, 0.8)
  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
      <motion.line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="rgb(239 68 68)"
        strokeWidth="2.4"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0.9 }}
        animate={{ pathLength: 1, opacity: 0.5 }}
        transition={{ duration: 0.2 }}
      />
    </svg>
  )
}

/** The Wind Wall on one side of Yasuo. */
function WallBar({ side }: { side: Side }) {
  const middle = alongPath(side, WALL_AT)
  const across = side === 0 || side === 2
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.2 }}
      transition={{ duration: 0.12 }}
      className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-linear-to-r from-cyan-200/40 via-white/90 to-cyan-200/40 shadow-[0_0_22px_rgb(165_243_252/0.95)] ${
        across ? 'h-[4%] w-[44%]' : 'h-[44%] w-[4%] bg-linear-to-b'
      }`}
      style={at(middle)}
      aria-hidden="true"
    />
  )
}

interface VolleySummaryProps {
  mine: WallScore
  final: [WallScore, WallScore] | null
  me: Player
  players: readonly [Contestant, Contestant]
}

/** After your last shot: your blocks, then both side by side. */
function VolleySummary({ mine, final, me, players }: VolleySummaryProps) {
  const theirs = final?.[other(me)]
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.9 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-abyss/80 p-3 text-center backdrop-blur-[2px]"
    >
      <div className="grid w-full max-w-xs grid-cols-[1fr_auto_1fr] items-center gap-3">
        <SummarySide contestant={players[me]} score={mine} you best={theirs !== undefined && mine.blocked > theirs.blocked} />
        <span className="font-display text-lg text-gold/60">vs</span>
        {theirs ? (
          <SummarySide contestant={players[other(me)]} score={theirs} you={false} best={theirs.blocked > mine.blocked} />
        ) : (
          <span className="text-3xl text-gold-light/40">?</span>
        )}
      </div>
      {theirs !== undefined && theirs.blocked === mine.blocked && <p className="text-xs text-gold-light/70">Same blocks: the faster walls win</p>}
    </motion.div>
  )
}

function SummarySide({ contestant, score, you, best }: { contestant: Contestant; score: WallScore; you: boolean; best: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <img src={championIconById(contestant.champion)} alt={contestant.name} className={`size-12 rounded-full border-2 ${you ? 'border-hextech' : 'border-red-400'}`} />
      <span className={`font-display text-4xl font-black tabular-nums ${best ? 'text-gold' : you ? 'text-hextech' : 'text-red-400'}`}>
        {score.blocked}
        <span className="text-lg text-gold-light/50">/{WIND_WALL.shots}</span>
      </span>
      {score.blocked > 0 && <span className="text-xs text-gold-light/70">{(score.time / score.blocked / 1000).toFixed(2)} s a wall</span>}
    </div>
  )
}

/** 1: a shooter shows up on one side. 2: tap that side, the wall blocks it. 3: most blocked wins. */
export function WindWallTutorialArt({ step }: TutorialArtProps) {
  const backdrop = 'bg-[radial-gradient(circle_at_50%_50%,rgb(10_70_90/0.6),rgb(1_10_19))]'
  const yasuo = (
    <img src={championIconById('Yasuo')} alt="" className="absolute top-1/2 left-1/2 size-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-hextech" />
  )
  if (step === 0) {
    return (
      <div className={`relative size-full ${backdrop}`}>
        {yasuo}
        {[
          { left: '50%', top: '12%', delay: 0 },
          { left: '88%', top: '50%', delay: 0.7 },
          { left: '12%', top: '50%', delay: 1.4 },
        ].map(({ left, top, delay }) => (
          <motion.img
            key={left + top}
            src={championIconById(['Jinx', 'Ezreal', 'Caitlyn'][Math.round(delay / 0.7)] ?? 'Jinx')}
            alt=""
            animate={{ opacity: [0, 1, 1, 0, 0], scale: [0.7, 1.1, 1, 0.7, 0.7] }}
            transition={{ duration: 2.1, delay, repeat: Infinity, times: [0, 0.08, 0.3, 0.36, 1] }}
            className="absolute size-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500 shadow-[0_0_10px_rgb(239_68_68)]"
            style={{ left, top }}
          />
        ))}
      </div>
    )
  }
  if (step === 1) {
    return (
      <div className={`relative size-full ${backdrop}`}>
        {yasuo}
        <img src={championIconById('Ezreal')} alt="" className="absolute top-1/2 left-[88%] size-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500" />
        <motion.img
          src={spellIconUrl('EzrealQ.png')}
          alt=""
          animate={{ left: ['76%', '70%', '70%'], opacity: [1, 1, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, times: [0, 0.45, 0.55] }}
          className="absolute top-1/2 size-[14%] -translate-x-1/2 -translate-y-1/2 rounded border border-orange-300"
        />
        <motion.span
          animate={{ opacity: [0, 0, 1, 1, 0], scaleY: [0.3, 0.3, 1, 1, 0.3] }}
          transition={{ duration: 1.6, repeat: Infinity, times: [0, 0.25, 0.32, 0.8, 1] }}
          className="absolute top-1/2 left-[64%] h-[44%] w-[5%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_10px_rgb(165_243_252)]"
        />
        <motion.span
          animate={{ scale: [1, 0.85, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, times: [0, 0.3, 0.4] }}
          className="absolute right-[2%] bottom-[4%] text-lg sm:text-2xl"
        >
          👆
        </motion.span>
      </div>
    )
  }
  return (
    <div className={`flex size-full flex-col items-center justify-center gap-[6%] ${backdrop}`}>
      <img src={WIND_WALL_ICON} alt="" className="size-[34%] rounded-md border-2 border-cyan-200" />
      <span className="font-display text-sm font-black text-gold sm:text-xl">9/12</span>
      <div className="flex gap-[3%]">
        {[1, 1, 0, 1, 1, 1].map((blocked, index) => (
          <span key={index} className={`size-1.5 rounded-full sm:size-2 ${blocked ? 'bg-gold' : 'bg-red-400'}`} />
        ))}
      </div>
    </div>
  )
}
