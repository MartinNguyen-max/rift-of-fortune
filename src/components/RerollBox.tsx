import { motion } from 'framer-motion'

export interface RerollBoxProps {
  /** E.g. "Champion rerolls". */
  label: string
  left: number
  total: number
  /** What to tap, e.g. "Tap any champion to reroll it." */
  hint: string
}

/** Reroll pips and what to tap, shared by champion and item rerolls (Match vs Bots). */
export function RerollBox({ label, left, total, hint }: RerollBoxProps) {
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
                animate={available ? { scale: 1, opacity: 1 } : { scale: [1.4, 0.85], opacity: 0.35 }}
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
      <p className="mt-1.5 text-center text-xs text-gold-light/70">{left === 0 ? 'No rerolls left. Live with your choices.' : hint}</p>
    </div>
  )
}
