import { motion } from 'framer-motion'
import { useState } from 'react'
import type { PresenceInfo } from '../../game/multiplayer/protocol'
import { TIMINGS } from '../../game/multiplayer/session'
import { Button } from '../Button'
import { inviteLink, routeHref } from '../useHashRoute'
import { EmoteBar } from './Emotes'
import { SeriesScore } from './SeriesScore'
import type { Room } from './useRoom'

/** Share the code, wait for a friend, both press Ready: the draft starts. */
export function Lobby({ room, code }: { room: Room; code: string }) {
  const { me, opponent, setReady, sendEmote, wins } = room
  const bothReady = me.ready && opponent?.ready === true

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-5">
      <InviteCard code={code} />

      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <PlayerCard player={me} label="You" side="blue" />
        <span className="font-display text-3xl font-black text-gold sm:text-4xl">VS</span>
        {opponent ? (
          <PlayerCard player={opponent} label="Opponent" side="red" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gold/30 bg-panel/40 p-4 text-center">
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="text-3xl"
              aria-hidden="true"
            >
              ⏳
            </motion.span>
            <p className="text-sm text-gold-light/70">Waiting for a friend to join…</p>
          </div>
        )}
      </div>

      {opponent && <SeriesScore me={me} opponent={opponent} wins={wins} />}

      <div className="flex flex-col items-center gap-2">
        <Button onClick={() => setReady(!me.ready)} disabled={!opponent} className={me.ready ? 'bg-gold/20' : ''}>
          {me.ready ? 'Ready ✓' : 'Ready'}
        </Button>
        <p className="text-center text-sm text-gold-light/60" aria-live="polite">
          {!opponent
            ? 'Send the link or the code to a friend.'
            : opponent.playing
              ? 'Your opponent is still finishing the last game.'
              : bothReady
                ? 'Both ready. Starting the draft…'
                : me.ready
                  ? 'Waiting for your opponent to press Ready.'
                  : `When you are both ready, you get ${TIMINGS.draft} seconds to draft your team.`}
        </p>
      </div>

      {opponent && <EmoteBar onEmote={sendEmote} />}

      <a href={routeHref('play')} className="text-sm text-hextech underline-offset-4 hover:underline">
        Leave lobby
      </a>
    </div>
  )
}

function InviteCard({ code }: { code: string }) {
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)
  const copy = (what: 'link' | 'code') => {
    navigator.clipboard.writeText(what === 'link' ? inviteLink(code) : code).then(
      () => setCopied(what),
      () => setCopied(null),
    )
  }

  return (
    <section className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-gold/40 bg-panel/80 p-5 text-center shadow-2xl shadow-black/50">
      <p className="text-xs tracking-widest text-gold/70 uppercase">Lobby code</p>
      <p className="font-mono text-4xl font-black tracking-[0.35em] text-gold-light select-all sm:text-5xl">{code}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => copy('link')}>{copied === 'link' ? 'Link copied!' : 'Copy invite link'}</Button>
        <button
          type="button"
          onClick={() => copy('code')}
          className="rounded-md border border-gold/40 px-4 py-2 text-sm font-semibold text-gold-light/80 transition hover:border-gold"
        >
          {copied === 'code' ? 'Code copied!' : 'Copy code'}
        </button>
      </div>
      <p className="text-xs text-gold-light/50">Your friend opens the link, or presses "Join game" and types the code.</p>
    </section>
  )
}

function PlayerCard({ player, label, side }: { player: PresenceInfo; label: string; side: 'blue' | 'red' }) {
  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`flex min-w-0 flex-col items-center gap-1 rounded-xl border-2 bg-panel/70 p-4 text-center ${
        player.ready ? 'border-gold shadow-lg shadow-gold/20' : 'border-gold/30'
      }`}
    >
      <p className="text-[10px] tracking-widest text-gold/60 uppercase">{label}</p>
      <p className={`max-w-full leading-tight [overflow-wrap:anywhere] font-display text-base font-black sm:text-lg ${side === 'blue' ? 'text-hextech' : 'text-red-400'}`}>
        {player.name}
      </p>
      <p className={`text-sm font-semibold ${player.ready ? 'text-gold' : 'text-gold-light/50'}`}>
        {player.playing ? 'In a game' : player.ready ? 'Ready ✓' : 'Not ready'}
      </p>
    </motion.div>
  )
}
