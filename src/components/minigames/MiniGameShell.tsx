import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { endOfGameIconUrl } from '../../data'
import type { MiniGameInfo } from '../../game/minigames/catalog'
import type { RecordUpdate } from '../../game/minigames/records'
import { finisherFor } from '../../game/finishers'
import { MINI_GAME_RULES } from '../../game/minigames/registry'
import { botMoves, soloSetup, withMove, type BothMoves, type Moves, type Settled } from '../../game/minigames/versus'
import { saveOutcome } from '../../services/miniGameRecords'
import { playSound, prepareChampionVoice } from '../../services/sound'
import { Button } from '../Button'
import { routeHref } from '../useHashRoute'
import { FinisherVideo } from './FinisherVideo'
import { GameOpening } from './GameOpening'
import { MiniGameIntro } from './MiniGameIntro'
import { championIconById } from './miniGameArt'
import type { Contestant } from './types'
import { MINI_GAME_VIEWS } from './views'

const newSeed = () => Math.floor(Math.random() * 2 ** 32)

/** One mini-game against the bot: the tutorial, then the game, then Victory or Defeat with a rematch button. */
export function MiniGameShell({ info }: { info: MiniGameInfo }) {
  const [seed, setSeed] = useState<number | null>(null)
  const players = useMemo<[Contestant, Contestant]>(
    () => [
      { name: 'You', champion: info.champion, isBot: false },
      { name: info.botName, champion: info.botChampion, isBot: true },
    ],
    [info],
  )

  const start = () => {
    prepareChampionVoice(info.champion)()
    setSeed(newSeed())
  }

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between gap-3">
        <a href={routeHref('minigames')} className="text-sm text-hextech underline-offset-4 hover:underline">
          ← All mini-games
        </a>
        <div className="flex min-w-0 items-center gap-2">
          <img src={championIconById(info.champion)} alt="" className="size-8 rounded-full border border-gold/60" />
          <h2 className="font-display text-lg font-black text-gold sm:text-xl">{info.name}</h2>
        </div>
      </div>

      <div className="relative w-full rounded-xl border border-gold/30 bg-panel/70 p-3 shadow-2xl shadow-black/50 sm:p-6">
        {seed === null ? (
          <MiniGameIntro info={info} you={players[0]} them={players[1]} live={false}>
            <Button onClick={start}>Start</Button>
          </MiniGameIntro>
        ) : (
          <SoloGame key={seed} info={info} seed={seed} players={players} onRematch={start} />
        )}
      </div>
    </div>
  )
}

interface SoloGameProps {
  info: MiniGameInfo
  seed: number
  players: [Contestant, Contestant]
  onRematch: () => void
}

interface Outcome {
  settled: Settled
  update: RecordUpdate
  moves: BothMoves
}

/** Your moves come from the game screen; the bot answers each one at once. */
function SoloGame({ info, seed, players, onRematch }: SoloGameProps) {
  const rules = MINI_GAME_RULES[info.id]
  const { Game } = MINI_GAME_VIEWS[info.id]
  const setup = useMemo(() => soloSetup(seed), [seed])
  const [mine, setMine] = useState<Moves>([])
  const bot = useMemo(() => botMoves(rules, mine, setup), [rules, mine, setup])
  const moves = useMemo<BothMoves>(() => [mine, bot], [mine, bot])
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [opened, setOpened] = useState(false)
  const [finished, setFinished] = useState(false)
  const saved = useRef(false)
  const open = useCallback(() => setOpened(true), [])
  const finish = useCallback(() => setFinished(true), [])

  const sendMove = useCallback((step: number, value: number) => setMine((current) => withMove(current, step, value)), [])

  const showResult = useCallback(() => {
    const settled = rules.settle(moves, setup)
    if (!settled || saved.current) return
    saved.current = true
    const update = saveOutcome(info.id, {
      winner: settled.winner,
      score: rules.best?.of(moves, setup) ?? null,
      lowerIsBetter: rules.best?.lowerIsBetter ?? false,
    })
    setOutcome({ settled, update, moves })
  }, [rules, moves, setup, info.id])

  if (!opened) return <GameOpening info={info} you={players[0]} them={players[1]} onDone={open} />
  const finisher = outcome && !finished ? finisherOf(outcome.settled, players) : null
  return (
    <>
      <div className={outcome ? 'pointer-events-none opacity-30 blur-[2px]' : ''} aria-hidden={outcome !== null}>
        <Game setup={setup} me={0} moves={moves} sendMove={sendMove} onShown={showResult} players={players} />
      </div>
      {outcome && finisher ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-abyss/85 p-3">
          <FinisherVideo finisher={finisher} won={outcome.settled.winner === 0} onDone={finish} />
        </div>
      ) : (
        outcome && <ResultOverlay info={info} outcome={outcome} players={players} seed={seed} onRematch={onRematch} />
      )}
    </>
  )
}

/** The winner's finisher animation, if their champion has one (a draw has none). */
const finisherOf = ({ winner }: Settled, players: readonly [Contestant, Contestant]) =>
  winner === null ? null : finisherFor(players[winner].champion)

const VERDICTS = {
  win: { title: 'Victory', color: 'text-gold' },
  lose: { title: 'Defeat', color: 'text-red-400' },
  draw: { title: 'Draw', color: 'text-gold-light' },
} as const

interface ResultOverlayProps {
  info: MiniGameInfo
  outcome: Outcome
  players: [Contestant, Contestant]
  seed: number
  onRematch: () => void
}

function ResultOverlay({ info, outcome, players, seed, onRematch }: ResultOverlayProps) {
  const rules = MINI_GAME_RULES[info.id]
  const { Reveal } = MINI_GAME_VIEWS[info.id]
  const { settled, update, moves } = outcome
  const setup = soloSetup(seed)
  const verdict = settled.winner === null ? 'draw' : settled.winner === 0 ? 'win' : 'lose'
  const { title, color } = VERDICTS[verdict]
  const bestText = update.newBest && update.record.best !== null && rules.best ? rules.best.format(update.record.best) : null

  useEffect(() => {
    if (verdict !== 'draw') playSound(verdict === 'win' ? 'victory' : 'defeat')
  }, [verdict])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 overflow-y-auto rounded-xl bg-abyss/75 p-4 text-center"
      role="dialog"
      aria-label={title}
    >
      {verdict !== 'draw' && <img src={endOfGameIconUrl(verdict === 'win' ? 'victory' : 'defeat')} alt="" className="h-20 object-contain sm:h-24" />}
      <p className={`font-display text-5xl font-black uppercase ${color}`}>{title}</p>
      {Reveal && <Reveal setup={setup} me={0} moves={moves} settled={settled} players={players} />}
      <div className="grid grid-cols-2 gap-6">
        <Score label="You" value={rules.formatScore(settled.scores[0], setup)} highlight={settled.winner === 0} />
        <Score label={info.botName} value={rules.formatScore(settled.scores[1], setup)} highlight={settled.winner === 1} />
      </div>
      {(bestText || update.newBestStreak) && (
        <motion.p
          initial={{ scale: 0.4, rotate: -8, opacity: 0 }}
          animate={{ scale: 1, rotate: -3, opacity: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 260, damping: 11 }}
          className="rounded-md border-2 border-hextech bg-hextech/15 px-3 py-1 font-display text-lg font-black text-hextech uppercase"
        >
          {bestText ? `New best! ${bestText}` : `New best streak: ${update.record.streak} wins`}
        </motion.p>
      )}
      {!bestText && !update.newBestStreak && update.record.streak >= 2 && (
        <p className="text-sm font-semibold text-gold">🔥 {update.record.streak} wins in a row</p>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={onRematch}>Rematch</Button>
        <a
          href={routeHref('minigames')}
          className="rounded-md border-2 border-gold/50 px-6 py-2.5 font-display font-bold tracking-wider text-gold-light/80 uppercase transition hover:border-gold"
        >
          Other games
        </a>
      </div>
    </motion.div>
  )
}

function Score({ label, value, highlight }: { label: string; value: string; highlight: boolean }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-xs tracking-wider text-gold-light/60 uppercase [overflow-wrap:anywhere]">{label}</span>
      <span className={`font-display text-2xl font-black ${highlight ? 'text-gold' : 'text-gold-light/80'}`}>{value}</span>
    </div>
  )
}
