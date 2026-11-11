import type { RolledChampion } from '../game/gameState'
import { Button } from './Button'
import { ChampionRoll } from './ChampionRoll'
import { RolledChampionCard } from './RolledChampionCard'

interface DraftPanelProps {
  rolled: RolledChampion | null
  pickNumber: number
  canRoll: boolean
  teamComplete: boolean
  onRoll: () => void
  onRevealed: () => void
  onStartItems: () => void
}

export function DraftPanel({
  rolled,
  pickNumber,
  canRoll,
  teamComplete,
  onRoll,
  onRevealed,
  onStartItems,
}: DraftPanelProps) {
  if (teamComplete) {
    return (
      <section className="flex flex-col items-center gap-6 text-center">
        <h2 className="text-sm font-semibold tracking-widest text-gold/80 uppercase">Team locked in</h2>
        <p className="text-gold-light/70">Five brave souls. Now let&apos;s see what the shop gives them.</p>
        <Button onClick={onStartItems}>Draw 10 items</Button>
      </section>
    )
  }

  return (
    <section className="flex flex-col items-center gap-6 text-center">
      <h2 className="text-sm font-semibold tracking-widest text-gold/80 uppercase">Pick {pickNumber} of 5</h2>

      {rolled === null && (
        <>
          <p className="text-gold-light/70">Spin the roulette to get your next champion.</p>
          <Button onClick={onRoll} disabled={!canRoll}>
            Roll champion
          </Button>
        </>
      )}

      {rolled && !rolled.revealed && <ChampionRoll champion={rolled.champion} onRevealed={onRevealed} />}

      {rolled?.revealed && (
        <>
          <RolledChampionCard champion={rolled.champion} />
          <p className="text-sm text-gold-light/70">Drag onto an empty role, or click a glowing slot.</p>
        </>
      )}
    </section>
  )
}
