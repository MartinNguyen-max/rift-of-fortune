import type { RolledChampion } from '../game/gameState'
import { Button } from './Button'
import { ChampionRoll } from './ChampionRoll'
import { RerollBox, type RerollBoxProps } from './RerollBox'
import { RolledChampionCard } from './RolledChampionCard'

interface DraftPanelProps {
  rolled: RolledChampion | null
  pickNumber: number
  canRoll: boolean
  teamComplete: boolean
  onRoll: () => void
  onRevealed: () => void
  onStartItems: () => void
  /** Match vs Bots: champion rerolls, shown once the team is complete. */
  rerolls?: RerollBoxProps
}

export function DraftPanel({
  rolled,
  pickNumber,
  canRoll,
  teamComplete,
  onRoll,
  onRevealed,
  onStartItems,
  rerolls,
}: DraftPanelProps) {
  if (teamComplete) {
    return (
      <section className="flex flex-col items-center gap-3 text-center lg:gap-6">
        <h2 className="text-sm font-semibold tracking-widest text-gold/80 uppercase">Team locked in</h2>
        <p className="text-gold-light/70">
          {rerolls && rerolls.left > 0
            ? `Not happy with someone? Tap any champion to reroll them. Only ${rerolls.total} rerolls, so choose wisely.`
            : 'Five brave souls. Now let’s see what the shop gives them.'}
        </p>
        {rerolls && <RerollBox {...rerolls} />}
        <Button onClick={onStartItems}>Roll items</Button>
      </section>
    )
  }

  return (
    <section className="flex flex-col items-center gap-3 text-center lg:gap-6">
      <h2 className="text-sm font-semibold tracking-widest text-gold/80 uppercase">Pick {pickNumber} of 5</h2>

      {rolled === null && (
        <>
          <p className="hidden text-gold-light/70 lg:block">Spin the roulette to get your next champion.</p>
          <Button onClick={onRoll} disabled={!canRoll}>
            Roll champion
          </Button>
        </>
      )}

      {rolled && !rolled.revealed && <ChampionRoll champion={rolled.champion} onRevealed={onRevealed} />}

      {rolled?.revealed && (
        <>
          <RolledChampionCard champion={rolled.champion} />
          <p className="text-sm text-gold-light/70">
            <span className="lg:hidden">Tap a glowing slot.</span>
            <span className="hidden lg:inline">Drag onto an empty role, or click a glowing slot.</span>
          </p>
        </>
      )}
    </section>
  )
}
