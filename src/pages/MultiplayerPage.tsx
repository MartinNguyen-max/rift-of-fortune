import { useState, type FormEvent } from 'react'
import { Button } from '../components/Button'
import { RoomView } from '../components/multiplayer/RoomView'
import { roomHref, useRoomCode } from '../components/useHashRoute'
import { createRoomCode, parseRoomCode, ROOM_CODE_LENGTH } from '../game/multiplayer/roomCode'
import { isMultiplayerAvailable } from '../services/realtime'

/** Create or join a lobby, then play in it. The lobby code lives in the URL: #/play/K7Q2X. */
export function MultiplayerPage() {
  const code = useRoomCode()

  if (!isMultiplayerAvailable()) {
    return (
      <p className="max-w-md rounded-xl border border-gold/30 bg-panel/70 p-5 text-center text-gold-light/80">
        Multiplayer isn't set up on this site yet. It needs the Supabase settings in <code>.env.local</code>.
      </p>
    )
  }
  if (code) return <RoomView key={code} code={code} />
  return <StartScreen />
}

function StartScreen() {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const join = (event: FormEvent) => {
    event.preventDefault()
    const code = parseRoomCode(input)
    if (code) window.location.hash = roomHref(code)
    else setError(true)
  }

  return (
    <div className="grid w-full max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
      <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-gold/30 bg-panel/70 p-5 shadow-2xl shadow-black/50 backdrop-blur">
        <h2 className="font-display text-2xl font-black text-gold">Create game</h2>
        <p className="flex-1 text-sm text-gold-light/80">
          Send a friend the link. Draft at the same time, then fight it out in four live mini-games.
        </p>
        <Button onClick={() => (window.location.hash = roomHref(createRoomCode()))}>Create game</Button>
      </section>

      <form
        onSubmit={join}
        className="flex min-w-0 flex-col gap-3 rounded-xl border border-gold/30 bg-panel/70 p-5 shadow-2xl shadow-black/50 backdrop-blur"
      >
        <h2 className="font-display text-2xl font-black text-gold">Join game</h2>
        <label htmlFor="room-code" className="text-sm text-gold-light/80">
          Got a code from a friend? Type or paste it here.
        </label>
        <input
          id="room-code"
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            setError(false)
          }}
          placeholder="K7Q2X"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={200}
          size={8}
          className="w-full min-w-0 rounded-md border-2 border-gold/40 bg-abyss/70 px-4 py-2.5 text-center font-mono text-2xl tracking-[0.3em] text-gold-light uppercase outline-none placeholder:text-gold-light/20 focus:border-gold"
        />
        {error && (
          <p role="alert" className="text-sm text-red-400">
            That's not a lobby code. Codes are {ROOM_CODE_LENGTH} letters and numbers.
          </p>
        )}
        <Button type="submit" disabled={input.trim() === ''}>
          Join game
        </Button>
      </form>
    </div>
  )
}
