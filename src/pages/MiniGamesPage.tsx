import { MiniGameList } from '../components/minigames/MiniGameList'
import { MiniGameShell } from '../components/minigames/MiniGameShell'
import { useMiniGameId } from '../components/useHashRoute'
import { MINI_GAMES } from '../game/minigames/catalog'

/** The mini-game arcade: a list of games, each played against a bot (for now). */
export function MiniGamesPage() {
  const id = useMiniGameId()
  return id ? <MiniGameShell key={id} info={MINI_GAMES[id]} /> : <MiniGameList />
}
