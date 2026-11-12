import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { getSoundSettings, setSoundSettings, startSavedMusic, subscribeToSound } from '../services/sound'

/** Two small buttons in the top right corner: sound effects on/off and music on/off. */
export function SoundToggle() {
  const { effects, music } = useSyncExternalStore(subscribeToSound, getSoundSettings)

  useEffect(() => {
    startSavedMusic()
  }, [])

  return (
    <div className="absolute top-2 right-1.5 z-20 flex gap-1 sm:top-3 sm:right-4 sm:gap-1.5">
      <ToggleButton
        on={effects}
        label={effects ? 'Mute sound effects' : 'Turn sound effects on'}
        onClick={() => setSoundSettings({ effects: !effects })}
      >
        <path d="M4 9v6h4l5 4V5L8 9H4z" />
        {effects ? (
          <path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" fill="none" />
        ) : (
          <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" />
        )}
      </ToggleButton>
      <ToggleButton on={music} label={music ? 'Turn music off' : 'Turn music on'} onClick={() => setSoundSettings({ music: !music })}>
        <path d="M9 18V6l10-2v12" fill="none" />
        <circle cx="6.5" cy="18" r="2.5" />
        <circle cx="16.5" cy="16" r="2.5" />
        {!music && <path d="M3 3l18 18" fill="none" />}
      </ToggleButton>
    </div>
  )
}

interface ToggleButtonProps {
  on: boolean
  label: string
  onClick: () => void
  children: ReactNode
}

function ToggleButton({ on, label, onClick, children }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      title={label}
      className={`flex size-7 items-center justify-center rounded-full border bg-panel/80 backdrop-blur transition hover:border-gold sm:size-9 ${
        on ? 'border-gold/60 text-gold' : 'border-gold/20 text-gold-light/35'
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-3.5 sm:size-[18px]" fill="currentColor" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  )
}
