import { useEffect, useState } from 'react'
import { parseMiniGameId, type MiniGameId } from '../game/minigames/catalog'
import { parseRoomCode } from '../game/multiplayer/roomCode'

export type Route = 'home' | 'classic' | 'daily' | 'match' | 'play' | 'minigames'

const PAGES: readonly Route[] = ['classic', 'daily', 'match', 'play', 'minigames']

const pathOf = (hash: string) => hash.replace(/^#\/?/, '')

/** "#/daily" → "daily", "#/play/K7Q2X" → "play". Anything unknown goes to the homepage. */
export function parseRoute(hash: string): Route {
  const [page] = pathOf(hash).split('/')
  return PAGES.find((route) => route === page) ?? 'home'
}

export const routeHref = (route: Route): string => (route === 'home' ? '#/' : `#/${route}`)

/** The lobby code in "#/play/K7Q2X", or null on the plain multiplayer page. */
export function roomCodeFromHash(hash: string): string | null {
  const [page, code] = pathOf(hash).split('/')
  return page === 'play' && code ? parseRoomCode(code) : null
}

export const roomHref = (code: string): string => `${routeHref('play')}/${code}`

/** The mini-game in "#/minigames/hook", or null on the mini-game list. */
export function miniGameFromHash(hash: string): MiniGameId | null {
  const [page, id] = pathOf(hash).split('/')
  return page === 'minigames' ? parseMiniGameId(id) : null
}

export const miniGameHref = (id: MiniGameId): string => `${routeHref('minigames')}/${id}`

/** The full invite link for a lobby, to send to a friend. */
export const inviteLink = (code: string): string =>
  `${window.location.origin}${window.location.pathname}${roomHref(code)}`

/** The current URL hash, so links like /#/daily or /#/play/K7Q2X can be shared. */
function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash)
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return hash
}

/** The current page. */
export function useHashRoute(): Route {
  return parseRoute(useHash())
}

/** The open mini-game in the URL, if any. */
export function useMiniGameId(): MiniGameId | null {
  return miniGameFromHash(useHash())
}

/** The lobby code in the URL, if any. */
export function useRoomCode(): string | null {
  return roomCodeFromHash(useHash())
}
