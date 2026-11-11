import { MotionConfig } from 'framer-motion'
import { Footer } from './components/Footer'
import { routeHref, useHashRoute } from './components/useHashRoute'
import { ClassicPage } from './pages/ClassicPage'
import { DailyPage } from './pages/DailyPage'
import { HomePage } from './pages/HomePage'

export default function App() {
  const route = useHashRoute()

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col">
        <header className="px-4 pt-6 pb-4 text-center sm:pt-8 sm:pb-6">
          <h1 className="font-display text-3xl font-black tracking-wide text-gold drop-shadow-[0_0_12px_rgb(200_170_110/0.35)] sm:text-5xl">
            <a href={routeHref('home')}>LoL Rift Roulette</a>
          </h1>
          <p className="mt-1 text-sm text-gold-light/60">Random champions. Random items. Honest feedback.</p>
          {route !== 'home' && (
            <nav className="mt-2 text-sm">
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
        </main>
        <Footer />
      </div>
    </MotionConfig>
  )
}
