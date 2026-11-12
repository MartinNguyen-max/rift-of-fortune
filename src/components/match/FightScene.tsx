import { motion } from 'framer-motion'
import { championIconUrl } from '../../data'
import { CASTER_NAMES, momentTitle, type CommentaryLine } from '../../game/match/commentary'
import type { MatchEvent, MatchTeams, Side } from '../../game/match/types'
import { ROLES } from '../../game/roles'
import { EventIcon } from './EventIcon'
import { SIDE_TEXT } from './matchStyles'

interface FightSceneProps {
  event: MatchEvent
  /** The caster line for this moment, shown under the stamp. */
  line: CommentaryLine | null
  teams: MatchTeams
  /** How far the scene has played, 0–1. */
  progress: number
}

/** Kills land one by one in the first part of the scene, then the title stamps down and the caster speaks. */
const KILLS_END = 0.35
const TITLE_AT = 0.15
const LINE_AT = 0.3

/** A big moment played out over the map: both teams, the kills landing one by one, then a big stamp. */
export function FightScene({ event, line, teams, progress }: FightSceneProps) {
  const killsLanded = event.kills.length === 0 ? 0 : Math.ceil((progress / KILLS_END) * event.kills.length)
  const landed = event.kills.slice(0, killsLanded)
  const dead = (side: Side, role: string) => landed.some(({ victim }) => victim.side === side && victim.role === role)
  const scored = (side: Side, role: string) => landed.filter(({ killer }) => killer.side === side && killer.role === role).length
  const tally = { blue: landed.filter(({ killer }) => killer.side === 'blue').length, red: landed.filter(({ killer }) => killer.side === 'red').length }
  const isEnd = event.kind === 'nexus' || event.kind === 'surrender'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex flex-col items-center justify-center bg-abyss/85 p-2 backdrop-blur-[2px] sm:p-3"
    >
      {event.kills.length > 0 ? (
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
          <TeamColumn side="blue" event={event} teams={teams} dead={dead} scored={scored} />
          <div className="flex flex-col items-center font-display font-black tabular-nums">
            <span className="text-xs text-gold/70">⚔</span>
            <span className="text-3xl text-hextech">{tally.blue}</span>
            <span className="text-3xl text-red-400">{tally.red}</span>
          </div>
          <TeamColumn side="red" event={event} teams={teams} dead={dead} scored={scored} />
        </div>
      ) : (
        <motion.div
          initial={{ scale: 0.4, rotate: -10 }}
          animate={{ scale: [0.4, 1.2, 1], rotate: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center gap-1"
        >
          <EventIcon event={event} className="size-16 text-5xl drop-shadow-[0_0_12px_rgba(0,0,0,0.8)] sm:size-20 sm:text-6xl" />
          {!isEnd && <span className={`font-display text-lg font-bold ${SIDE_TEXT[event.side]}`}>{teams[event.side].name}</span>}
        </motion.div>
      )}

      {progress >= TITLE_AT && (
        <motion.p
          initial={{ scale: 2.4, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: -4 }}
          transition={{ type: 'spring', stiffness: 380, damping: 14 }}
          className={`mt-2 text-center font-display text-2xl font-black tracking-wider uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] sm:text-4xl ${
            isEnd ? (event.side === 'blue' ? 'text-gold' : 'text-red-400') : SIDE_TEXT[event.side]
          }`}
        >
          {momentTitle(event)}
        </motion.p>
      )}
      {line && progress >= LINE_AT && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1 max-w-[95%] text-center text-xs font-semibold text-gold-light sm:text-sm"
        >
          “{line.text}” <span className="font-normal text-gold/60">— {CASTER_NAMES[line.caster]}</span>
        </motion.p>
      )}
    </motion.div>
  )
}

interface TeamColumnProps {
  side: Side
  event: MatchEvent
  teams: MatchTeams
  dead: (side: Side, role: string) => boolean
  scored: (side: Side, role: string) => number
}

function TeamColumn({ side, event, teams, dead, scored }: TeamColumnProps) {
  const won = event.side === side
  return (
    <ul className={`flex flex-col gap-0.5 sm:gap-1 ${side === 'red' ? 'items-end' : 'items-start'}`}>
      {ROLES.filter((role) => event.kind === 'teamfight' || involved(event, side, role)).map((role) => {
        const champion = teams[side].rating.champions.find((entry) => entry.role === role)
        if (!champion) return null
        const isDead = dead(side, role)
        const kills = scored(side, role)
        return (
          <li key={role} className={`flex items-center gap-1 ${side === 'red' ? 'flex-row-reverse' : ''}`}>
            <motion.span
              className="relative block"
              animate={isDead ? { scale: [1.3, 0.85], x: side === 'blue' ? [-4, 0] : [4, 0] } : kills > 0 ? { scale: [1, 1.25, 1] } : { scale: 1 }}
              transition={{ duration: 0.35 }}
            >
              <img
                src={championIconUrl(champion.champion.image)}
                alt={champion.champion.name}
                className={`size-7 rounded-full border-2 transition sm:size-9 ${
                  isDead ? 'border-abyss opacity-40 grayscale' : won ? 'border-gold' : side === 'blue' ? 'border-hextech' : 'border-red-400'
                }`}
              />
              {isDead && (
                <motion.span
                  initial={{ scale: 2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute inset-0 flex items-center justify-center text-lg"
                  aria-label="died"
                >
                  💀
                </motion.span>
              )}
            </motion.span>
            {kills > 0 && <span className={`text-xs font-bold ${SIDE_TEXT[side]}`}>{'⚔'.repeat(Math.min(kills, 5))}</span>}
          </li>
        )
      })}
    </ul>
  )
}

/** Whether a champion killed, died or assisted in this event. */
function involved({ kills }: MatchEvent, side: Side, role: string): boolean {
  return kills.some(
    ({ killer, victim, assists }) =>
      (killer.side === side && (killer.role === role || assists.some((assist) => assist === role))) ||
      (victim.side === side && victim.role === role),
  )
}
