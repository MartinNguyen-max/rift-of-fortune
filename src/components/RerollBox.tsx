import { AnimatePresence, motion } from 'framer-motion'
import { Button } from './Button'

export interface RerollBoxProps {
  /** E.g. "Champion rerolls". */
  label: string
  left: number
  total: number
  /** What to tap, shown while nothing is picked, e.g. "Tap any champion to reroll it." */
  hint: string
  /** The champion or item picked for a reroll, waiting for the player to confirm. */
  selectedName: string | null
  onConfirm: () => void
  onCancel: () => void
  /** An extra choice next to Reroll, e.g. taking an item back. */
  secondary?: { label: string; onClick: () => void }
}

/** Reroll pips and the confirm step, shared by champion and item rerolls (Match vs Bots). */
export function RerollBox({ label, left, total, hint, selectedName, onConfirm, onCancel, secondary }: RerollBoxProps) {
  return (
    <div className="w-full rounded-lg border border-gold/30 bg-abyss/50 p-2.5">
      <div className="flex items-center justify-center gap-2">
        <span className="text-[10px] font-semibold tracking-widest text-gold/80 uppercase">{label}</span>
        <ol className="flex gap-1.5" aria-label={`${left} of ${total} rerolls left`}>
          {Array.from({ length: total }, (_, index) => {
            const available = index < left
            return (
              <motion.li
                key={index}
                aria-hidden="true"
                animate={available ? { scale: 1, opacity: 1 } : { scale: 0.85, opacity: 0.35 }}
                className={`flex size-6 items-center justify-center rounded-full border text-sm ${
                  available ? 'border-gold bg-gold/15 text-gold shadow-[0_0_8px_rgb(200_170_110/0.4)]' : 'border-gold/30 text-gold/40'
                }`}
              >
                ↻
              </motion.li>
            )
          })}
        </ol>
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        {selectedName ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="mt-2 flex flex-col items-center gap-2"
          >
            <p className="text-sm text-gold-light">
              Reroll <span className="font-bold text-gold">{selectedName}</span>?
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button onClick={onConfirm} disabled={left === 0} className="px-4 py-1.5 text-sm">
                Reroll ↻
              </Button>
              {secondary && (
                <button type="button" onClick={secondary.onClick} className="text-sm text-hextech underline-offset-4 hover:underline">
                  {secondary.label}
                </button>
              )}
              <button type="button" onClick={onCancel} className="text-sm text-gold-light/60 underline-offset-4 hover:underline">
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
            className="mt-1.5 text-center text-xs text-gold-light/70"
          >
            {left === 0 ? 'No rerolls left. Live with your choices.' : hint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
