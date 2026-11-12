import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { spellIconUrl } from '../../data'
import { winnerByScore } from '../../game/minigames/catalog'
import {
  botComboBest,
  checkCombo,
  COMBO_KEYS,
  COMBO_MAX_LENGTH,
  COMBO_START_LENGTH,
  comboCheer,
  comboSpam,
  flashSeconds,
  inputSeconds,
  toComboKey,
  type ComboKey,
} from '../../game/minigames/combo'
import { useCountdown } from '../multiplayer/useCountdown'
import type { MiniGameProps } from './MiniGameShell'
import { championIconById } from './miniGameArt'

const SPELLS: Record<ComboKey, { name: string; icon: string; color: string }> = {
  Q: { name: 'Wilding Claw', icon: 'UdyrQ.png', color: 'border-red-400 shadow-red-500/50' },
  W: { name: 'Iron Mantle', icon: 'UdyrW.png', color: 'border-sky-300 shadow-sky-400/50' },
  E: { name: 'Blazing Stampede', icon: 'UdyrE.png', color: 'border-orange-300 shadow-orange-400/50' },
  R: { name: 'Wingborne Storm', icon: 'UdyrR.png', color: 'border-cyan-200 shadow-cyan-300/50' },
}

/** Pause between two flashed keys, so the same key twice in a row can be seen. */
const GAP_SECONDS = 0.14
const CHEER_SECONDS = 1.3

type Phase = 'showing' | 'input' | 'cheer'

/** Udyr Has No Combo: a Simon game with Q, W, E and R. */
export function ComboGame({ seed, onFinish }: MiniGameProps) {
  const spam = useMemo(() => comboSpam(seed), [seed])
  const botBest = useMemo(() => botComboBest(seed), [seed])
  const [length, setLength] = useState(COMBO_START_LENGTH)
  const [phase, setPhase] = useState<Phase>('showing')
  const [typed, setTyped] = useState<ComboKey[]>([])
  const [failed, setFailed] = useState(false)
  const best = length - 1 < COMBO_START_LENGTH ? 0 : length - 1

  const finish = useCallback(
    (playerBest: number) => {
      setFailed(true)
      onFinish({ winner: winnerByScore(playerBest, botBest), player: `${playerBest} keys`, bot: `${botBest} keys` })
    },
    [botBest, onFinish],
  )

  const press = useCallback(
    (key: ComboKey) => {
      if (phase !== 'input' || failed) return
      const next = [...typed, key]
      const check = checkCombo(spam, length, next)
      setTyped(next)
      if (check === 'wrong') finish(best)
      else if (check === 'complete') {
        if (length > botBest || length === COMBO_MAX_LENGTH) finish(length)
        else setPhase('cheer')
      }
    },
    [phase, failed, typed, spam, length, best, botBest, finish],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = toComboKey(event.key)
      if (!key || event.repeat || event.ctrlKey || event.metaKey) return
      event.preventDefault()
      press(key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press])

  // After a cheer: the next, longer spam.
  useEffect(() => {
    if (phase !== 'cheer') return
    const id = window.setTimeout(() => {
      setLength((value) => value + 1)
      setTyped([])
      setPhase('showing')
    }, CHEER_SECONDS * 1000)
    return () => window.clearTimeout(id)
  }, [phase])

  const startInput = useCallback(() => setPhase('input'), [])
  const timeout = useCallback(() => finish(best), [finish, best])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between text-sm">
        <span className="text-gold-light/70">
          Spam length <span className="font-display text-lg font-black text-gold">{length}</span>
        </span>
        <BotStatus botBest={botBest} length={length} />
      </div>

      <div className="flex h-44 w-full flex-col items-center justify-center">
        {phase === 'showing' && <Flasher key={length} keys={spam.slice(0, length)} onDone={startInput} />}
        {phase === 'input' && !failed && <InputTimer key={length} seconds={inputSeconds(length)} onTimeout={timeout} />}
        {phase === 'input' && <Typed typed={typed} length={length} failed={failed} />}
        {phase === 'cheer' && (
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
            <p className="font-display text-3xl font-black text-gold">Combo x{length}!</p>
            <p className="text-gold-light/75">{comboCheer(length)}</p>
          </motion.div>
        )}
      </div>

      <div className="grid w-full max-w-md grid-cols-4 gap-2 sm:gap-3">
        {COMBO_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onPointerDown={() => press(key)}
            disabled={phase !== 'input' || failed}
            className="group flex touch-manipulation flex-col items-center gap-1 rounded-lg border-2 border-gold/50 bg-abyss/60 p-2 transition enabled:hover:border-gold enabled:active:scale-95 disabled:opacity-40"
          >
            <img src={spellIconUrl(SPELLS[key].icon)} alt={SPELLS[key].name} className="size-12 rounded sm:size-14" draggable={false} />
            <span className="font-display text-xl font-black text-gold-light">{key}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-gold-light/50">Tap the buttons or press Q, W, E, R.</p>
    </div>
  )
}

/** Flashes the spam one key at a time, then hands over to the player. */
function Flasher({ keys, onDone }: { keys: ComboKey[]; onDone: () => void }) {
  const [index, setIndex] = useState(-1)
  const [visible, setVisible] = useState(false)
  const flash = flashSeconds(keys.length)

  useEffect(() => {
    const delay = index === -1 ? 700 : visible ? flash * 1000 : GAP_SECONDS * 1000
    const id = window.setTimeout(() => {
      if (visible) {
        setVisible(false)
        return
      }
      if (index + 1 >= keys.length) onDone()
      else {
        setIndex(index + 1)
        setVisible(true)
      }
    }, delay)
    return () => window.clearTimeout(id)
  }, [index, visible, flash, keys.length, onDone])

  const key = keys[index]
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <img src={championIconById('Udyr')} alt="Udyr" className="size-10 rounded-full border border-gold/60" />
        <p className="font-display text-lg font-bold text-gold-light/80">{index === -1 ? 'Udyr is warming up...' : 'Watch the spam!'}</p>
      </div>
      <div className="flex size-24 items-center justify-center">
        <AnimatePresence>
          {visible && key && (
            <motion.div
              key={index}
              initial={{ scale: 0.4, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 1.3, opacity: 0 }}
              transition={{ duration: 0.12 }}
              className={`relative overflow-hidden rounded-xl border-4 shadow-lg ${SPELLS[key].color}`}
            >
              <img src={spellIconUrl(SPELLS[key].icon)} alt={key} className="size-24" />
              <span className="absolute right-1 bottom-0 font-display text-3xl font-black text-white drop-shadow-[0_2px_3px_black]">
                {key}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Dots total={keys.length} filled={index + 1} />
    </div>
  )
}

function Typed({ typed, length, failed }: { typed: ComboKey[]; length: number; failed: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className={`font-display text-lg font-bold ${failed ? 'text-red-400' : 'text-gold-light/80'}`}>
        {failed ? 'Wrong key! Your wrists gave out.' : 'Your turn: repeat the spam'}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {Array.from({ length }, (_, index) => {
          const key = typed[index]
          const wrong = failed && index === typed.length - 1
          return (
            <span
              key={index}
              className={`flex size-9 items-center justify-center rounded border-2 font-display font-black ${
                !key ? 'border-gold/25 text-transparent' : wrong ? 'border-red-400 text-red-400' : 'border-gold text-gold-light'
              }`}
            >
              {key ?? '·'}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function InputTimer({ seconds, onTimeout }: { seconds: number; onTimeout: () => void }) {
  const [deadline] = useState(() => Date.now() + seconds * 1000)
  const left = useCountdown(deadline)

  useEffect(() => {
    const id = window.setTimeout(onTimeout, Math.max(0, deadline - Date.now()))
    return () => window.clearTimeout(id)
  }, [deadline, onTimeout])

  return (
    <div className="mb-3 h-1.5 w-48 overflow-hidden rounded-full bg-abyss">
      <div className="h-full bg-hextech transition-[width] duration-200" style={{ width: `${(left / seconds) * 100}%` }} />
    </div>
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

function BotStatus({ botBest, length }: { botBest: number; length: number }) {
  const out = length > botBest
  return (
    <span className="flex items-center gap-2 text-gold-light/70">
      <img src={championIconById('Udyr')} alt="" className={`size-7 rounded-full border border-red-400/70 ${out ? 'grayscale' : ''}`} />
      {out ? `Bot Udyr fat-fingered at ${botBest + 1}!` : 'Bot Udyr: still spamming...'}
    </span>
  )
}
