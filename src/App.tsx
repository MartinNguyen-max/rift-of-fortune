import { lazy, Suspense } from 'react'
import { MotionConfig } from 'framer-motion'
import { Footer } from './components/Footer'
import { SoundToggle } from './components/SoundToggle'
import { routeHref, useHashRoute } from './components/useHashRoute'
import { ClassicPage } from './pages/ClassicPage'
import { DailyPage } from './pages/DailyPage'
import { HomePage } from './pages/HomePage'
import { MatchPage } from './pages/MatchPage'

/** Loaded only when opened: it brings the Supabase Realtime client, which the other modes don't need. */
const MultiplayerPage = lazy(() => import('./pages/MultiplayerPage').then(({ MultiplayerPage }) => ({ default: MultiplayerPage })))
/** Loaded only when opened, so the other modes don't download six mini-games. */
const MiniGamesPage = lazy(() => import('./pages/MiniGamesPage').then(({ MiniGamesPage }) => ({ default: MiniGamesPage })))

export default function App() {
  const route = useHashRoute()

  return (
    <MotionConfig reducedMotion="user">
      {/* Big slam-in words start scaled up: clip sideways so a phone never scrolls sideways mid-animation. */}
      <div className="flex min-h-screen flex-col overflow-x-clip">
        <header className="relative px-4 pt-3 pb-2 text-center lg:pt-8 lg:pb-6">
          <SoundToggle key={route} hint={route === 'home'} />
          <h1 className="font-display text-xl font-black tracking-wide text-gold drop-shadow-[0_0_12px_rgb(200_170_110/0.35)] sm:text-3xl lg:text-5xl">
            <a href={routeHref('home')}>Rift of Fortune</a>
          </h1>
          <p className={`mt-1 text-sm text-gold-light/60 ${route === 'home' ? '' : 'hidden lg:block'}`}>Random champions. Random items. Honest feedback.</p>
          {route !== 'home' && (
            <nav className="mt-1 text-sm lg:mt-2">
              <a href={routeHref('home')} className="text-hextech underline-offset-4 hover:underline">
                ← All modes
              </a>
            </nav>
          )}
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 pb-8">
          {route === 'home' && <HomePage />}
          {route === 'classic' && <ClassicPage />}
          {route === 'daily' && <DailyPage />}
          {route === 'match' && <MatchPage />}
          {route === 'minigames' && (
            <Suspense fallback={<p className="text-gold-light/60">Loading…</p>}>
              <MiniGamesPage />
            </Suspense>
          )}
          {route === 'play' && (
            <Suspense fallback={<p className="text-gold-light/60">Loading…</p>}>
              <MultiplayerPage />
            </Suspense>
          )}
        </main>
        <Footer />
      </div>
    </MotionConfig>
  )
}
