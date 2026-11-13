import { useEffect, useState } from 'react'

/** Two taps, so nobody gives up by accident. Ends the game at once. */
export function SurrenderButton({ onSurrender }: { onSurrender: () => void }) {
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!confirming) return
    const id = window.setTimeout(() => setConfirming(false), 3000)
    return () => window.clearTimeout(id)
  }, [confirming])

  return (
    <button
      type="button"
      onClick={() => (confirming ? onSurrender() : setConfirming(true))}
      className={`self-center rounded-md border px-4 py-1 text-sm font-semibold transition ${
        confirming ? 'border-red-400 bg-red-950/60 text-red-300' : 'border-gold/30 text-gold-light/60 hover:border-red-400'
      }`}
    >
      {confirming ? 'Tap again to surrender' : 'Surrender 🏳️'}
    </button>
  )
}
