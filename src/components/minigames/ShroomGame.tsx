import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { spellIconUrl } from '../../data'
import { seededRandom } from '../../game/random'
import {
  botPlan,
  botSteps,
  emptyPlan,
  isPlanReady,
  MAX_SHROOM_GAMES,
  PATH_STEPS,
  SHROOM_COUNT,
  shroomsPlaced,
  shroomWinner,
  SIDES,
  STEP_SECONDS,
  toggleShroom,
  walkPath,
  type ShroomPlan,
  type Side,
  type WalkResult,
} from '../../game/minigames/shrooms'
import { Button } from '../Button'
import { useCountdown } from '../multiplayer/useCountdown'
import type { MiniGameProps } from './MiniGameShell'
import { championIconById } from './miniGameArt'

const SHROOM_ICON = spellIconUrl('TeemoR.png')
const BOT_STEP_SECONDS = 0.8
const VERDICT_SECONDS = 2.8

type Phase = 'plant' | 'botWalk' | 'botPlant' | 'playerWalk' | 'verdict'

/** Everything the bot does in one game, decided up front from the seed. */
interface BotMoves {
  plan: ShroomPlan
  steps: Side[]
  /** The side the player jumps to on each step if their time runs out. */
  fallback: Side[]
}

/** Shroom Hopscotch: plant 3 shrooms for the bot, then walk through the bot's. Furthest walk wins. */
export function ShroomGame({ seed, onFinish }: MiniGameProps) {
  const moves = useMemo<BotMoves[]>(() => {
    const random = seededRandom(seed)
    return Array.from({ length: MAX_SHROOM_GAMES }, () => ({
      plan: botPlan(random),
      steps: botSteps(random),
      fallback: botSteps(random),
    }))
  }, [seed])
  const [game, setGame] = useState(0)
  const [phase, setPhase] = useState<Phase>('plant')
  const [plan, setPlan] = useState<ShroomPlan>(emptyPlan)
  const [botShown, setBotShown] = useState(0)
  const [playerSteps, setPlayerSteps] = useState<Side[]>([])
  const bot = moves[game] ?? moves[0]
  if (!bot) throw new Error('No bot moves')

  const botWalk = useMemo(() => walkPath(plan, bot.steps), [plan, bot])
  const botWalkSteps = botWalk.boomAt === null ? PATH_STEPS : botWalk.boomAt + 1
  const playerWalk = useMemo(() => walkPath(bot.plan, playerSteps), [bot, playerSteps])
  const playerDone = playerWalk.boomAt !== null || playerSteps.length >= PATH_STEPS

  // The bot walks the player's path, one step at a time.
  useEffect(() => {
    if (phase !== 'botWalk') return
    const id = window.setTimeout(
      () => {
        if (botShown < botWalkSteps) setBotShown(botShown + 1)
        else setPhase('botPlant')
      },
      (botShown === botWalkSteps ? 1.6 : BOT_STEP_SECONDS) * 1000,
    )
    return () => window.clearTimeout(id)
  }, [phase, botShown, botWalkSteps])

  useEffect(() => {
    if (phase !== 'botPlant') return
    const id = window.setTimeout(() => setPhase('playerWalk'), 1600)
    return () => window.clearTimeout(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'playerWalk' || !playerDone) return
    const id = window.setTimeout(() => setPhase('verdict'), 1400)
    return () => window.clearTimeout(id)
  }, [phase, playerDone])

  // The verdict: a winner ends the game, a tie plays again (up to MAX_SHROOM_GAMES).
  useEffect(() => {
    if (phase !== 'verdict') return
    const outcome = shroomWinner(playerWalk, botWalk)
    const id = window.setTimeout(() => {
      const lastGame = game + 1 >= MAX_SHROOM_GAMES
      if (outcome !== 'tie' || lastGame) {
        onFinish({
          winner: outcome === 'tie' ? 'draw' : outcome,
          player: `${playerWalk.safeSteps} / ${PATH_STEPS} steps`,
          bot: `${botWalk.safeSteps} / ${PATH_STEPS} steps`,
        })
        return
      }
      setGame(game + 1)
      setPlan(emptyPlan())
      setBotShown(0)
      setPlayerSteps([])
      setPhase('plant')
    }, VERDICT_SECONDS * 1000)
    return () => window.clearTimeout(id)
  }, [phase, playerWalk, botWalk, game, onFinish])

  const step = useCallback(
    (side: Side) => {
      if (phase !== 'playerWalk' || playerDone) return
      setPlayerSteps((steps) => (steps.length >= PATH_STEPS ? steps : [...steps, side]))
    },
    [phase, playerDone],
  )

  useEffect(() => {
    if (phase !== 'playerWalk') return
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') step('left')
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') step('right')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, step])

  const fallbackStep = useCallback(() => step(bot.fallback[playerSteps.length] ?? 'left'), [step, bot, playerSteps.length])

  return (
    <div className="flex flex-col items-center gap-3">
      {game > 0 && <p className="text-xs tracking-wider text-hextech uppercase">Tie-break {game}</p>}

      {phase === 'plant' && (
        <>
          <Header icon={championIconById('Teemo')} title="You are Teemo. Plant your shrooms!" sub={`${shroomsPlaced(plan)} / ${SHROOM_COUNT} planted. Master Yi walks next.`} />
          <Path plan={plan} showShrooms steps={[]} walker={null} onTap={(row, side) => setPlan(toggleShroom(plan, row, side))} />
          <Button onClick={() => setPhase('botWalk')} disabled={!isPlanReady(plan)}>
            Done planting
          </Button>
        </>
      )}

      {phase === 'botWalk' && (
        <>
          <Header icon={championIconById('MasterYi')} title="Master Yi walks your path..." sub={walkLine('Master Yi', botWalk, botShown, botWalkSteps)} />
          <Path plan={plan} showShrooms steps={bot.steps.slice(0, botShown)} walker={championIconById('MasterYi')} boomAt={botShown === botWalkSteps ? botWalk.boomAt : null} />
        </>
      )}

      {phase === 'botPlant' && (
        <Header icon={championIconById('MasterYi')} title="Master Yi borrowed Teemo’s shrooms." sub="He is hiding 3 on your path. Get ready!" />
      )}

      {phase === 'playerWalk' && (
        <>
          <Header
            icon={championIconById('Teemo')}
            title={playerDone ? (playerWalk.boomAt === null ? 'You made it across!' : 'BOOM!') : `Step ${playerSteps.length + 1}: left or right?`}
            sub={playerDone ? `You walked ${playerWalk.safeSteps} steps.` : `Master Yi walked ${botWalk.safeSteps}. Beat it!`}
          />
          {!playerDone && <StepTimer key={playerSteps.length} onTimeout={fallbackStep} />}
          <Path
            plan={bot.plan}
            showShrooms={playerDone}
            steps={playerSteps}
            walker={championIconById('Teemo')}
            boomAt={playerWalk.boomAt}
            onTap={playerDone ? undefined : (row, side) => row === playerSteps.length && step(side)}
            activeRow={playerDone ? null : playerSteps.length}
          />
          {!playerDone && (
            <div className="flex gap-3">
              <Button onClick={() => step('left')}>← Left</Button>
              <Button onClick={() => step('right')}>Right →</Button>
            </div>
          )}
        </>
      )}

      {phase === 'verdict' && <Verdict player={playerWalk} bot={botWalk} />}
    </div>
  )
}

function walkLine(name: string, walk: WalkResult, shown: number, total: number): string {
  if (shown < total) return `Step ${shown + 1}...`
  return walk.boomAt === null ? `${name} made it across. Ouch.` : `BOOM! ${name} walked ${walk.safeSteps} steps.`
}

function Header({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <img src={icon} alt="" className="size-12 rounded-full border-2 border-gold/70" />
      <div>
        <p className="font-display text-lg font-black text-gold">{title}</p>
        <p className="text-sm text-gold-light/70">{sub}</p>
      </div>
    </div>
  )
}

interface PathProps {
  plan: ShroomPlan
  showShrooms: boolean
  /** The sides walked so far. */
  steps: Side[]
  walker: string | null
  boomAt?: number | null
  onTap?: (row: number, side: Side) => void
  /** The row the walker picks next, highlighted. */
  activeRow?: number | null
}

/** The path, bottom to top: two tiles per step, the finish at the top. */
function Path({ plan, showShrooms, steps, walker, boomAt = null, onTap, activeRow = null }: PathProps) {
  const rows = Array.from({ length: PATH_STEPS }, (_, row) => row).reverse()
  const walkerRow = steps.length - 1
  return (
    <div className="flex w-full max-w-xs flex-col gap-1.5 rounded-lg border border-gold/30 bg-linear-to-t from-emerald-950/80 to-emerald-900/40 p-3">
      <p className="text-center font-display text-sm font-bold tracking-widest text-gold/80 uppercase">Finish</p>
      {rows.map((row) => (
        <div key={row} className={`grid grid-cols-2 gap-2 rounded-md p-0.5 ${activeRow === row ? 'animate-pulse bg-gold/15' : ''}`}>
          {SIDES.map((side) => {
            const hasShroom = plan[row] === side
            const walked = steps[row] === side
            const boom = boomAt === row && walked
            return (
              <button
                key={side}
                type="button"
                onClick={() => onTap?.(row, side)}
                disabled={!onTap}
                aria-label={`Step ${row + 1} ${side}`}
                className={`relative flex h-12 items-center justify-center rounded-md border-2 transition ${
                  boom ? 'border-red-500 bg-red-500/30' : walked ? 'border-gold bg-gold/15' : 'border-emerald-700/60 bg-emerald-800/40'
                } enabled:hover:border-gold`}
              >
                {showShrooms && hasShroom && <img src={SHROOM_ICON} alt="Shroom" className={`size-8 rounded-full ${boom ? '' : 'opacity-90'}`} />}
                <AnimatePresence>
                  {walker && walked && (row === walkerRow || boom) && (
                    <motion.img
                      key={`${row}-${side}`}
                      src={walker}
                      alt=""
                      initial={{ y: 18, scale: 0.6, opacity: 0 }}
                      animate={boom ? { scale: [1, 1.5, 0], rotate: 180, opacity: [1, 1, 0] } : { y: 0, scale: 1, opacity: 1 }}
                      transition={{ duration: boom ? 0.9 : 0.25 }}
                      className="absolute size-9 rounded-full border-2 border-gold"
                    />
                  )}
                </AnimatePresence>
                {boom && <span className="absolute -top-2 right-1 font-display text-sm font-black text-red-400">BOOM</span>}
              </button>
            )
          })}
        </div>
      ))}
      <p className="text-center text-xs tracking-widest text-gold-light/50 uppercase">Start</p>
    </div>
  )
}

function StepTimer({ onTimeout }: { onTimeout: () => void }) {
  const [deadline] = useState(() => Date.now() + STEP_SECONDS * 1000)
  const left = useCountdown(deadline)

  useEffect(() => {
    const id = window.setTimeout(onTimeout, Math.max(0, deadline - Date.now()))
    return () => window.clearTimeout(id)
  }, [deadline, onTimeout])

  return (
    <div className="h-1.5 w-48 overflow-hidden rounded-full bg-abyss">
      <div className="h-full bg-hextech transition-[width] duration-200" style={{ width: `${(left / STEP_SECONDS) * 100}%` }} />
    </div>
  )
}

function Verdict({ player, bot }: { player: WalkResult; bot: WalkResult }) {
  const outcome = shroomWinner(player, bot)
  const text = outcome === 'tie' ? 'Tie! Plant again.' : outcome === 'player' ? 'You walked further!' : 'Master Yi walked further.'
  return (
    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-2 py-8 text-center">
      <p className="font-display text-3xl font-black text-gold">{text}</p>
      <p className="text-gold-light/75">
        You {player.safeSteps} steps · Master Yi {bot.safeSteps} steps
      </p>
      {outcome === 'tie' && <p className="text-sm text-gold-light/60">“Never underestimate the power of the Scout’s code.”</p>}
    </motion.div>
  )
}
