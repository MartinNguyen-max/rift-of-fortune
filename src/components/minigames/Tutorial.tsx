import { motion } from 'framer-motion'
import { MINI_GAMES, tutorialCaptions, type MiniGameId } from '../../game/minigames/catalog'
import { MINI_GAME_VIEWS } from './views'

/** The rules as three numbered pictures with a few words each. The same in solo and Multiplayer. */
export function Tutorial({ id, live }: { id: MiniGameId; live: boolean }) {
  const { TutorialArt } = MINI_GAME_VIEWS[id]
  const captions = tutorialCaptions(MINI_GAMES[id], live)
  return (
    <ol className="grid w-full grid-cols-3 gap-2 sm:gap-3" aria-label="How to play">
      {captions.map((caption, index) => {
        const step = index === 0 ? 0 : index === 1 ? 1 : 2
        return (
          <motion.li
            key={caption}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 + index * 0.18 }}
            className="relative flex min-w-0 flex-col items-center gap-1.5 rounded-lg border border-gold/30 bg-abyss/60 p-1.5 sm:p-2"
          >
            <span className="absolute -top-2 -left-2 z-10 flex size-6 items-center justify-center rounded-full border-2 border-gold bg-panel font-display text-sm font-black text-gold">
              {index + 1}
            </span>
            <div className="relative aspect-square w-full overflow-hidden rounded-md bg-panel/80" aria-hidden="true">
              <TutorialArt step={step} />
            </div>
            <p className="text-center text-[11px] leading-tight font-semibold text-gold-light sm:text-sm">{caption}</p>
          </motion.li>
        )
      })}
    </ol>
  )
}
