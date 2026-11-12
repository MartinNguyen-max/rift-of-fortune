import { useEffect, useState } from 'react'

export type Route = 'home' | 'classic' | 'daily' | 'match'

const PAGES: readonly Route[] = ['classic', 'daily', 'match']

/** "#/daily" → "daily". Anything unknown goes to the homepage. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  return PAGES.find((page) => page === path) ?? 'home'
}

export const routeHref = (route: Route): string => (route === 'home' ? '#/' : `#/${route}`)

/** The current page, from the URL hash, so links like /#/daily can be shared. */
export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))

  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}
