import { gameData } from '../data'
import { Button } from '../components/Button'
import { Game } from '../components/Game'
import { rollChampion } from '../game/draft'
import { drawItems } from '../game/items'
import type { GameState } from '../game/gameState'

const nextChampion = (state: GameState) => rollChampion(gameData.champions, state.team)
const randomItems = () => drawItems(gameData.items)

/** The main mode: random champions, random items, play as often as you like. */
export function ClassicPage() {
  return (
    <Game
      title="Classic"
      nextChampion={nextChampion}
      drawItems={randomItems}
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
