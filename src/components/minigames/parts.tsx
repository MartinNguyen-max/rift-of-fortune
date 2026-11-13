import { motion } from 'framer-motion'
import { useState } from 'react'
import { useCountdown } from '../useCountdown'
import { championIconById } from './miniGameArt'
import { useTimeout } from './timing'
import type { Contestant } from './types'

/** Colors: you are always blue (hextech), the opponent red, wins gold. */
export type Tone = 'win' | 'lose' | 'you' | 'them' | 'plain'

const TONE_TEXT: Record<Tone, string> = {
  win: 'text-gold',
  lose: 'text-red-500',
  you: 'text-hextech',
  them: 'text-red-400',
  plain: 'text-gold-light',
}

const TONE_GLOW: Record<Tone, string> = {
  win: 'drop-shadow-[0_0_24px_rgb(200_170_110/0.8)]',
  lose: 'drop-shadow-[0_0_24px_rgb(239_68_68/0.7)]',
  you: 'drop-shadow-[0_0_24px_rgb(10_200_185/0.8)]',
  them: 'drop-shadow-[0_0_24px_rgb(248_113_113/0.7)]',
  plain: 'drop-shadow-[0_2px_8px_rgb(0_0_0/0.9)]',
}

interface BigCallProps {
  text: string
  tone: Tone
  /** A short line under the word. */
  sub?: string
  /** Covers the middle of the game area (the parent needs `relative`). */
  overlay?: boolean
  size?: 'huge' | 'large'
}

/** A huge word that slams in: WON, LOST, THROW, DODGE, ACE! Nobody can miss it. */
export function BigCall({ text, tone, sub, overlay = false, size = 'huge' }: BigCallProps) {
  const call = (
    <motion.div
      key={text}
      initial={{ scale: 2.6, opacity: 0, rotate: -6 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 13 }}
      className="flex flex-col items-center gap-1 text-center"
      role="status"
    >
      <span
        className={`font-display leading-none font-black tracking-wider uppercase ${TONE_TEXT[tone]} ${TONE_GLOW[tone]} ${
          size === 'huge' ? 'text-6xl sm:text-8xl' : 'text-4xl sm:text-5xl'
        } [-webkit-text-stroke:1px_rgb(1_10_19/0.6)]`}
      >
        {text}
      </span>
      {sub && (
        <motion.span
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="max-w-72 rounded bg-abyss/80 px-2 py-0.5 text-sm font-semibold text-gold-light"
        >
          {sub}
        </motion.span>
      )}
    </motion.div>
  )
  if (!overlay) return call
  return <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-2">{call}</div>
}

interface ChoiceTimerProps {
  seconds: number
  /** Called once when time runs out. Mount the timer again (new `key`) for the next choice. */
  onTimeout: () => void
  label?: string
}

/** A big countdown for a choice, turning red in the last seconds. */
export function ChoiceTimer({ seconds, onTimeout, label }: ChoiceTimerProps) {
  const [deadline] = useState(() => Date.now() + seconds * 1000)
  const left = useCountdown(deadline)
  const hurry = left <= Math.min(2, seconds / 2)
  useTimeout(onTimeout, seconds * 1000)

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-1" role="timer" aria-label={`${Math.ceil(left)} seconds left`}>
      <div className="flex items-baseline gap-2">
        {label && <span className="text-xs tracking-widest text-gold-light/60 uppercase">{label}</span>}
        <motion.span
          key={Math.ceil(left)}
          initial={{ scale: 1.4 }}
          animate={{ scale: 1 }}
          className={`font-mono text-3xl font-black tabular-nums ${hurry ? 'text-red-400' : 'text-gold-light'}`}
        >
          {Math.ceil(left)}
        </motion.span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-abyss/80">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-linear ${hurry ? 'bg-red-400' : 'bg-hextech'}`}
          style={{ width: `${(left / seconds) * 100}%` }}
        />
      </div>
    </div>
  )
}

/** "Waiting for Team Baron…", for Multiplayer when the opponent is still choosing. */
export function Waiting({ name }: { name: string }) {
  return (
    <motion.p
      animate={{ opacity: [0.45, 1, 0.45] }}
      transition={{ duration: 1.4, repeat: Infinity }}
      className="text-center text-sm font-semibold text-gold-light/80"
      aria-live="polite"
    >
      Waiting for {name}…
    </motion.p>
  )
}

interface ContestantTagProps {
  contestant: Contestant
  /** Your tag is blue and on the left, theirs red and on the right. */
  you: boolean
  /** A score or status next to the name. */
  value?: string
}

export function ContestantTag({ contestant, you, value }: ContestantTagProps) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${you ? '' : 'flex-row-reverse text-right'}`}>
      <img
        src={championIconById(contestant.champion)}
        alt=""
        className={`size-9 shrink-0 rounded-full border-2 ${you ? 'border-hextech' : 'border-red-400'}`}
      />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className={`text-xs font-semibold [overflow-wrap:anywhere] ${you ? 'text-hextech' : 'text-red-400'}`}>
          {contestant.name}
        </span>
        {value !== undefined && <span className="font-display text-lg font-black text-gold">{value}</span>}
      </div>
    </div>
  )
}
