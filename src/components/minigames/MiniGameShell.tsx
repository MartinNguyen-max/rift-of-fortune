import { motion } from 'framer-motion'
import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { endOfGameIconUrl } from '../../data'
import type { MiniGameId, MiniGameInfo, MiniGameResult } from '../../game/minigames/catalog'
import { playSound, prepareChampionVoice } from '../../services/sound'
import { Button } from '../Button'
import { routeHref } from '../useHashRoute'
import { CleaverGame } from './CleaverGame'
import { ComboGame } from './ComboGame'
import { DuelGame } from './DuelGame'
import { ForgeGame } from './ForgeGame'
import { HookGame } from './HookGame'
import { championIconById } from './miniGameArt'
import { ShroomGame } from './ShroomGame'

/** What every mini-game gets: a seed for its randomness and a way to report the result. */
export interface MiniGameProps {
  seed: number
  onFinish: (result: MiniGameResult) => void
}

const GAMES: Record<MiniGameId, ComponentType<MiniGameProps>> = {
  duel: DuelGame,
  hook: HookGame,
  combo: ComboGame,
  shrooms: ShroomGame,
  forge: ForgeGame,
  cleaver: CleaverGame,
}

const newSeed = () => Math.floor(Math.random() * 2 ** 32)

type Phase = 'intro' | 'playing' | 'result'

/** One mini-game: the rules, then the game, then Victory or Defeat with a rematch button. */
export function MiniGameShell({ info }: { info: MiniGameInfo }) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [seed, setSeed] = useState(newSeed)
  const [result, setResult] = useState<MiniGameResult | null>(null)
  const Game = GAMES[info.id]

  const start = () => {
    prepareChampionVoice(info.champion)()
    setSeed(newSeed())
    setResult(null)
    setPhase('playing')
  }

  const finish = useCallback((outcome: MiniGameResult) => {
    setResult(outcome)
    // A short pause so the last moment of the game can be seen before the result covers it.
    window.setTimeout(() => setPhase('result'), 900)
  }, [])

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between gap-3">
        <a href={routeHref('minigames')} className="text-sm text-hextech underline-offset-4 hover:underline">
          ← All mini-games
        </a>
        <div className="flex items-center gap-2">
          <img src={championIconById(info.champion)} alt="" className="size-8 rounded-full border border-gold/60" />
          <h2 className="font-display text-lg font-black text-gold sm:text-xl">{info.name}</h2>
        </div>
      </div>

      <div className="relative w-full rounded-xl border border-gold/30 bg-panel/70 p-4 shadow-2xl shadow-black/50 sm:p-6">
        {phase === 'intro' && <Intro info={info} onStart={start} />}
        {phase !== 'intro' && (
          <div className={phase === 'result' ? 'pointer-events-none opacity-30 blur-[2px]' : ''}>
            <Game key={seed} seed={seed} onFinish={finish} />
          </div>
        )}
        {phase === 'result' && result && <ResultOverlay info={info} result={result} onRematch={start} />}
      </div>
    </div>
  )
}

function Intro({ info, onStart }: { info: MiniGameInfo; onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="flex items-center gap-4">
        <img src={championIconById(info.champion)} alt={info.champion} className="size-20 rounded-full border-2 border-gold" />
        <span className="font-display text-2xl font-black text-gold-light/60">vs</span>
        <img
          src={championIconById(info.botChampion)}
          alt={info.botName}
          className="size-20 rounded-full border-2 border-red-400/70 grayscale-[30%]"
        />
      </div>
      <p className="text-sm text-gold-light/60">
        You vs <span className="font-semibold text-red-300">{info.botName}</span> (bot)
      </p>
      <ul className="flex max-w-md flex-col gap-1.5 text-left text-gold-light/85">
        {info.howTo.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="text-gold">◆</span>
            {line}
          </li>
        ))}
      </ul>
      <Button onClick={onStart}>Start</Button>
    </div>
  )
}

const VERDICTS = {
  player: { title: 'Victory', color: 'text-gold' },
  bot: { title: 'Defeat', color: 'text-red-400' },
  draw: { title: 'Draw', color: 'text-gold-light' },
} as const

function ResultOverlay({ info, result, onRematch }: { info: MiniGameInfo; result: MiniGameResult; onRematch: () => void }) {
  const verdict = VERDICTS[result.winner]

  useEffect(() => {
    if (result.winner !== 'draw') playSound(result.winner === 'player' ? 'victory' : 'defeat')
  }, [result.winner])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl bg-abyss/70 p-4 text-center"
      role="dialog"
      aria-label={verdict.title}
    >
      {result.winner !== 'draw' && (
        <img src={endOfGameIconUrl(result.winner === 'player' ? 'victory' : 'defeat')} alt="" className="h-24 object-contain" />
      )}
      <p className={`font-display text-5xl font-black uppercase ${verdict.color}`}>{verdict.title}</p>
      <div className="grid grid-cols-2 gap-6">
        <Score label="You" value={result.player} highlight={result.winner === 'player'} />
        <Score label={info.botName} value={result.bot} highlight={result.winner === 'bot'} />
      </div>
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
    <div className="flex flex-col">
      <span className="text-xs tracking-wider text-gold-light/60 uppercase">{label}</span>
      <span className={`font-display text-2xl font-black ${highlight ? 'text-gold' : 'text-gold-light/80'}`}>{value}</span>
    </div>
  )
}
