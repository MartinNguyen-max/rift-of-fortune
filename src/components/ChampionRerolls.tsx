import { AnimatePresence, motion } from 'framer-motion'
import { Button } from './Button'

export interface ChampionRerollControls {
  left: number
  total: number
  /** The champion picked for a reroll, waiting for the player to confirm. */
  selectedName: string | null
  /** False until at least one champion is placed. */
  hasChampions: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Reroll pips and the confirm step for swapping a placed champion. Match vs Bots only. */
export function ChampionRerolls({ left, total, selectedName, hasChampions, onConfirm, onCancel }: ChampionRerollControls) {
  return (
    <div className="w-full rounded-lg border border-gold/30 bg-abyss/50 p-2.5">
      <div className="flex items-center justify-center gap-2">
        <span className="text-[10px] font-semibold tracking-widest text-gold/80 uppercase">Rerolls</span>
        <ol className="flex gap-1.5" aria-label={`${left} of ${total} rerolls left`}>
          {Array.from({ length: total }, (_, index) => {
            const available = index < left
            return (
              <motion.li
                key={index}
                animate={available ? { scale: 1, opacity: 1 } : { scale: 0.85, opacity: 0.35 }}
                className={`flex size-6 items-center justify-center rounded-full border text-sm ${
                  available ? 'border-gold bg-gold/15 text-gold shadow-[0_0_8px_rgb(200_170_110/0.4)]' : 'border-gold/30 text-gold/40'
                }`}
                aria-hidden="true"
              >
                ↻
              </motion.li>
            )
          })}
        </ol>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {selectedName ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-2 flex flex-col items-center gap-2"
          >
            <p className="text-sm text-gold-light">
              Reroll <span className="font-bold text-gold">{selectedName}</span> into a random champion?
            </p>
            <div className="flex items-center gap-3">
              <Button onClick={onConfirm} className="px-4 py-1.5 text-sm">
                Reroll ↻
              </Button>
              <button type="button" onClick={onCancel} className="text-sm text-hextech underline-offset-4 hover:underline">
                Keep
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-1.5 text-center text-xs text-gold-light/60"
          >
            {left === 0
              ? 'No rerolls left. Live with your choices.'
              : hasChampions
                ? 'Tap one of your champions to reroll it.'
                : 'Place a champion, then tap it to reroll.'}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
