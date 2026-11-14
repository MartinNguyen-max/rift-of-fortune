import { motion } from 'framer-motion'
import { COIN_FLIP_MS } from './liveEventText'

interface CoinFlipProps {
  /** The side it lands on. */
  youWin: boolean
  /** The line under the coin once it has landed. */
  caption: string
}

/** A tie that needs a winner: a gold coin spins up and lands on blue (you) or red (them). */
export function CoinFlip({ youWin, caption }: CoinFlipProps) {
  const seconds = COIN_FLIP_MS / 1000
  return (
    <div className="flex flex-col items-center gap-2" role="status" aria-label={caption}>
      <p className="font-display text-lg font-black tracking-widest text-gold-light uppercase">Coin flip</p>
      <motion.div
        initial={{ rotateY: 0, y: 0 }}
        animate={{ rotateY: 1800 + (youWin ? 0 : 180), y: [0, -70, 0] }}
        transition={{ duration: seconds, ease: [0.2, 0.7, 0.3, 1] }}
        style={{ transformStyle: 'preserve-3d' }}
        className="relative size-20 sm:size-24"
        aria-hidden="true"
      >
        <Face label="YOU" className="bg-hextech/85" />
        <Face label="THEM" className="bg-red-600/85 [transform:rotateY(180deg)]" />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: seconds }}
        className={`font-display text-lg font-black ${youWin ? 'text-hextech' : 'text-red-400'}`}
      >
        {caption}
      </motion.p>
    </div>
  )
}

function Face({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`absolute inset-0 flex items-center justify-center rounded-full border-4 border-gold font-display text-lg font-black text-white shadow-[0_0_24px_rgb(200_170_110/0.6)] [backface-visibility:hidden] ${className}`}
    >
      {label}
    </span>
  )
}
