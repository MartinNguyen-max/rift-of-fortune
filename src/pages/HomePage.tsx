import { motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { Countdown } from '../components/Countdown'
import { routeHref, type Route } from '../components/useHashRoute'
import { championIconUrl, gameData, rankEmblemUrl, summonersRiftMapUrl } from '../data'
import { MINI_GAME_IDS, MINI_GAMES } from '../game/minigames/catalog'
import { championIconById } from '../components/minigames/miniGameArt'
import { dailyNumber, dateKey } from '../game/daily'
import { getTeamMembers } from '../game/gameState'
import { rankLabel } from '../game/scoring/rank'
import { rateTeam } from '../game/scoring/rateTeam'
import { loadDaily } from '../services/dailyProgress'

/** Today's Daily result, if it has been played. */
function todaysDailyRating() {
  const state = loadDaily(dateKey(new Date()))
  return state?.phase === 'results' ? rateTeam(getTeamMembers(state)) : null
}

export function HomePage() {
  const [number] = useState(() => dailyNumber(new Date()))
  const [dailyRating] = useState(todaysDailyRating)

  return (
    <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
      <ModeCard
        route="classic"
        badge="Main mode"
        title="Classic"
        cta="Play Classic"
        art={<img src={summonersRiftMapUrl} alt="" className="size-full object-cover opacity-30" />}
        delay={0}
      >
        Roll five random champions, place them on the Rift, hand out random items and get ranked from Iron to
        Challenger. Play as often as you want.
        <span className="mt-2 block text-gold-light/50 italic">Then try your team in a real game. We dare you.</span>
      </ModeCard>

      <ModeCard
        route="daily"
        badge={`Daily #${number}`}
        title="Daily Rift"
        cta={dailyRating ? 'See your result' : "Play today's Daily"}
        art={
          <span className="font-display text-8xl font-black text-gold/15 select-none sm:text-9xl">#{number}</span>
        }
        delay={0.1}
      >
        Same champions and items for everyone today. One try. Share your rank and see how you did against everyone
        else.
        {dailyRating ? (
          <span className="mt-3 flex items-center gap-3 rounded-lg border border-gold/20 bg-abyss/60 p-2">
            <img src={rankEmblemUrl(dailyRating.rank.tier)} alt="" className="size-12 object-contain" />
            <span className="flex flex-col">
              <span className="font-display font-bold text-gold-light">
                {rankLabel(dailyRating.rank)} · {dailyRating.score}
              </span>
              <span className="text-xs text-gold-light/60">
                Next Daily in <Countdown />
              </span>
            </span>
          </span>
        ) : null}
      </ModeCard>

      <ModeCard
        route="match"
        badge="New"
        title="Match vs Bots"
        cta="Fight a bot"
        art={<img src={rankEmblemUrl('Challenger')} alt="" className="size-56 object-contain opacity-20" />}
        delay={0.2}
      >
        Draft a team, then send it into a simulated match against a level 1–3 bot. Live scoreboard, first blood,
        stolen Barons and two casters who have seen too much.
      </ModeCard>

      <ModeCard
        route="play"
        badge="New · 1v1"
        title="Multiplayer"
        cta="Play a friend"
        art={
          <span className="font-display text-8xl font-black text-gold/15 select-none sm:text-9xl" aria-hidden="true">
            1v1
          </span>
        }
        delay={0.3}
      >
        Send a friend a link, draft at the same time, then fight it out. You pick the mini-games that become the live
        events of the match: read the gank, steal Baron, outdraw them at High Noon. Spam GG when you win.
      </ModeCard>

      <ModeCard route="minigames" badge="New" title="Mini-games" cta="Play mini-games" art={<MiniGameIcons />} delay={0.4} wide>
        {MINI_GAME_IDS.length} quick fights against a bot, each in under a minute. In Multiplayer they are the live
        events that swing the match.
        <MiniGameRundown />
      </ModeCard>
    </div>
  )
}

/** Every mini-game in one line each: who you play and what it is about. */
function MiniGameRundown() {
  return (
    <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="All mini-games">
      {MINI_GAME_IDS.map((id) => {
        const { name, champion, tagline } = MINI_GAMES[id]
        return (
          <li key={id} className="flex min-w-0 items-center gap-2.5 rounded-lg border border-gold/15 bg-abyss/60 p-2">
            <img src={championIconById(champion)} alt="" className="size-9 shrink-0 rounded-full border border-gold/40" />
            <span className="min-w-0">
              <span className="block font-display text-sm leading-tight font-bold text-gold-light [overflow-wrap:anywhere]">{name}</span>
              <span className="block text-xs leading-snug text-gold-light/60">{tagline}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** The mini-game champions in a loose ring, faded behind the card text. */
function MiniGameIcons() {
  const icons = MINI_GAME_IDS.map((id) => gameData.champions.find((champion) => champion.id === MINI_GAMES[id].champion))
  return (
    <span className="grid grid-cols-3 gap-3 opacity-20" aria-hidden="true">
      {icons.map((champion) =>
        champion ? <img key={champion.id} src={championIconUrl(champion.image)} alt="" className="size-20 rounded-full" /> : null,
      )}
    </span>
  )
}

interface ModeCardProps {
  route: Route
  badge: string
  title: string
  cta: string
  art: ReactNode
  delay: number
  /** Spans both columns, for an odd card out. */
  wide?: boolean
  children: ReactNode
}

function ModeCard({ route, badge, title, cta, art, delay, wide = false, children }: ModeCardProps) {
  return (
    <motion.a
      href={routeHref(route)}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay }}
      className={`${wide ? 'md:col-span-2' : ''} group relative isolate flex flex-col gap-3 overflow-hidden rounded-xl border border-gold/30 bg-panel/70 p-6 shadow-2xl shadow-black/50 backdrop-blur transition hover:border-gold hover:shadow-gold/10`}
    >
      <div className="absolute inset-0 -z-10 flex items-center justify-center">{art}</div>
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-panel via-panel/80 to-panel/40" />
      <span className="w-fit rounded-full border border-hextech/50 bg-hextech/10 px-2.5 py-0.5 text-xs font-semibold tracking-wider text-hextech uppercase">
        {badge}
      </span>
      <h2 className="font-display text-3xl font-black text-gold">{title}</h2>
      <div className="flex-1 text-sm text-gold-light/80">{children}</div>
      <span className="mt-2 w-fit rounded-md border-2 border-gold bg-panel px-6 py-2.5 font-display font-bold tracking-wider text-gold-light uppercase transition group-hover:bg-gold/20 group-hover:shadow-lg group-hover:shadow-gold/20">
        {cta}
      </span>
    </motion.a>
  )
}
