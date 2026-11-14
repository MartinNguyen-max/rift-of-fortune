import { Button } from '../components/Button'
import { Game } from '../components/Game'
import { nextChampion, randomItems, rerollChampion, rerollItem } from '../components/matchDraft'
import { CLASSIC_RULES } from '../game/rules'

/** The main mode: random champions, random items, a few rerolls, play as often as you like. */
export function ClassicPage() {
  return (
    <Game
      title="Classic"
      nextChampion={nextChampion}
      drawItems={randomItems}
      rules={CLASSIC_RULES}
      rerollChampion={rerollChampion}
      rerollItem={rerollItem}
      resultActions={(_, reset) => (
        <>
          <Button onClick={reset}>Play again</Button>
          <p className="text-sm text-gold-light/70">
            Now try this team in a real game. <span className="text-gold">We dare you.</span>
          </p>
        </>
      )}
    />
  )
}
