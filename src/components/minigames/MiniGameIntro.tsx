import type { ReactNode } from 'react'
import type { MiniGameInfo } from '../../game/minigames/catalog'
import { championIconById } from './miniGameArt'
import { Tutorial } from './Tutorial'
import type { Contestant } from './types'

interface MiniGameIntroProps {
  info: MiniGameInfo
  /** You first, then the opponent. */
  you: Contestant
  them: Contestant
  live: boolean
  /** One short line above the pictures, e.g. "You hide first". */
  note?: string
  /** The Start button (solo) or the Ready button (Multiplayer). */
  children: ReactNode
}

/** Before a mini-game: who plays who, the three-picture tutorial, and a button. Hardly any text. */
export function MiniGameIntro({ info, you, them, live, note, children }: MiniGameIntroProps) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Portrait contestant={you} you />
        <span className="font-display text-2xl font-black text-gold-light/60">vs</span>
        <Portrait contestant={them} you={false} />
      </div>
      {note && <p className="font-display text-lg font-black text-hextech">{note}</p>}
      <Tutorial id={info.id} live={live} />
      {children}
    </div>
  )
}

function Portrait({ contestant, you }: { contestant: Contestant; you: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <img
        src={championIconById(contestant.champion)}
        alt=""
        className={`size-16 rounded-full border-2 sm:size-20 ${you ? 'border-hextech' : 'border-red-400'}`}
      />
      <span className={`max-w-full text-sm font-semibold [overflow-wrap:anywhere] ${you ? 'text-hextech' : 'text-red-400'}`}>
        {contestant.name}
        {contestant.isBot && <span className="text-gold-light/50"> (bot)</span>}
      </span>
    </div>
  )
}
