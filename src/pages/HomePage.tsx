import { motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { Countdown } from '../components/Countdown'
import { routeHref, type Route } from '../components/useHashRoute'
import { rankEmblemUrl, summonersRiftMapUrl } from '../data'
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

      <ComingSoonCard title="Match vs Bots" icon="⚔️" delay={0.2}>
        Send your team into a simulated match against level 1–3 bots. Live scoreboard, first blood, stolen Barons and
        a commentator who has seen too much.
      </ComingSoonCard>

      <ComingSoonCard title="Multiplayer" icon="🤝" delay={0.3}>
        Draft against a friend, then watch both teams fight it out on the Rift. Settle who the real Rift Roulette
        champion is.
      </ComingSoonCard>
    </div>
  )
}

interface ComingSoonCardProps {
  title: string
  icon: string
  delay: number
  children: ReactNode
}

/** A mode that isn't playable yet: no link, dimmed, with a "Coming soon" badge. */
function ComingSoonCard({ title, icon, delay, children }: ComingSoonCardProps) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay }}
      aria-disabled="true"
      className="flex flex-col gap-2 rounded-xl border border-dashed border-gold/25 bg-panel/40 p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-black text-gold/70">
          <span aria-hidden="true" className="mr-2">
            {icon}
          </span>
          {title}
        </h2>
        <span className="shrink-0 rounded-full border border-gold/30 px-2.5 py-0.5 text-xs font-semibold tracking-wider text-gold/60 uppercase">
          Coming soon
        </span>
      </div>
      <p className="text-sm text-gold-light/60">{children}</p>
    </motion.div>
  )
}

interface ModeCardProps {
  route: Route
  badge: string
  title: string
  cta: string
  art: ReactNode
  delay: number
  children: ReactNode
}

function ModeCard({ route, badge, title, cta, art, delay, children }: ModeCardProps) {
  return (
    <motion.a
      href={routeHref(route)}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay }}
      className="group relative isolate flex flex-col gap-3 overflow-hidden rounded-xl border border-gold/30 bg-panel/70 p-6 shadow-2xl shadow-black/50 backdrop-blur transition hover:border-gold hover:shadow-gold/10"
    >
      <div className="absolute inset-0 -z-10 flex items-center justify-center">{art}</div>
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-panel via-panel/80 to-panel/40" />
      <span className="w-fit rounded-full border border-hextech/50 bg-hextech/10 px-2.5 py-0.5 text-xs font-semibold tracking-wider text-hextech uppercase">
        {badge}
      </span>
      <h2 className="font-display text-3xl font-black text-gold">{title}</h2>
      <p className="flex-1 text-sm text-gold-light/80">{children}</p>
      <span className="mt-2 w-fit rounded-md border-2 border-gold bg-panel px-6 py-2.5 font-display font-bold tracking-wider text-gold-light uppercase transition group-hover:bg-gold/20 group-hover:shadow-lg group-hover:shadow-gold/20">
        {cta}
      </span>
    </motion.a>
  )
}
