import { MotionConfig } from 'framer-motion'
import { Footer } from './components/Footer'
import { routeHref, useHashRoute } from './components/useHashRoute'
import { ClassicPage } from './pages/ClassicPage'
import { DailyPage } from './pages/DailyPage'
import { HomePage } from './pages/HomePage'
import { MatchPage } from './pages/MatchPage'

export default function App() {
  const route = useHashRoute()

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col">
        <header className="px-4 pt-3 pb-2 text-center lg:pt-8 lg:pb-6">
          <h1 className="font-display text-2xl font-black tracking-wide text-gold drop-shadow-[0_0_12px_rgb(200_170_110/0.35)] sm:text-3xl lg:text-5xl">
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
        </main>
        <Footer />
      </div>
    </MotionConfig>
  )
}
