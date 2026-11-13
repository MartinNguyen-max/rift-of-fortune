import type { ReactNode } from 'react'
import { Button } from '../Button'
import { routeHref } from '../useHashRoute'
import { EmoteLayer } from './Emotes'
import { Lobby } from './Lobby'
import { RoundView } from './RoundView'
import { useRoom } from './useRoom'

/** One lobby: connecting, the lobby itself, or the game being played in it. */
export function RoomView({ code }: { code: string }) {
  const room = useRoom(code)
  const { status, isPlayer, players, round, me, emotes } = room

  if (status === 'error') {
    return (
      <Notice title="Couldn't connect">
        The lobby server didn't answer. Check your connection and try again.
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </Notice>
    )
  }
  if (status === 'connecting') return <Notice title="Connecting…">Opening lobby {code}.</Notice>
  if (!isPlayer && players.length >= 2) {
    return (
      <Notice title="Lobby is full">
        Two players are already in lobby {code}.
        <a href={routeHref('play')} className="text-hextech underline-offset-4 hover:underline">
          Create your own game
        </a>
      </Notice>
    )
  }

  const inRound = round?.players.some(({ id }) => id === me.id) === true
  return (
    <>
      {status === 'reconnecting' && (
        <p
          role="status"
          className="fixed top-2 left-1/2 z-50 -translate-x-1/2 rounded-full border border-gold/50 bg-abyss/90 px-4 py-1.5 text-sm font-semibold text-gold-light shadow-lg shadow-black/60"
        >
          Connection lost. Reconnecting…
        </p>
      )}
      <EmoteLayer emotes={emotes} />
      {inRound && round ? <RoundView key={round.id} room={room} round={round} /> : <Lobby room={room} code={code} />}
    </>
  )
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-gold/30 bg-panel/70 p-6 text-center text-gold-light/80">
      <h2 className="font-display text-2xl font-black text-gold">{title}</h2>
      {children}
    </section>
  )
}
