import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { MINI_GAME_IDS, MINI_GAMES, type MiniGameId } from '../../game/minigames/catalog'
import { MINI_GAME_RULES } from '../../game/minigames/registry'
import {
  RANDOM_EVENT_COUNT,
  toggleGame,
  withEventMode,
  type EventMode,
  type LobbySettings,
  type Pace,
} from '../../game/multiplayer/settings'
import { championIconById } from '../minigames/miniGameArt'
import { PACE_TEXT } from './paceText'

interface LobbySettingsPanelProps {
  settings: LobbySettings
  /** Only the host (who created the game) can change them. */
  editable: boolean
  hostName: string
  onChange: (settings: LobbySettings) => void
}

const PACES: { value: Pace; label: string; hint: string }[] = (['normal', 'fast'] as const).map((value) => ({ value, ...PACE_TEXT[value] }))

const EVENT_MODES: { value: EventMode; label: string }[] = [
  { value: 'random3', label: `${RANDOM_EVENT_COUNT.random3} random` },
  { value: 'random5', label: `${RANDOM_EVENT_COUNT.random5} random` },
  { value: 'custom', label: 'Custom' },
]

/** The game settings in the lobby: pace, rerolls and which mini-games are the live events. */
export function LobbySettingsPanel({ settings, editable, hostName, onChange }: LobbySettingsPanelProps) {
  const change = (patch: Partial<LobbySettings>) => onChange({ ...settings, ...patch })
  const hasRoleGame = settings.games.some((id) => MINI_GAME_RULES[id].chances === 2)

  return (
    <section className="flex w-full flex-col gap-3 rounded-xl border border-gold/30 bg-panel/70 p-4" aria-label="Game settings">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-black text-gold">Game settings</h3>
        <span className="text-xs text-gold-light/60 [overflow-wrap:anywhere]">{editable ? 'You set the rules' : `Set by ${hostName}`}</span>
      </div>

      <Row label="Pace">
        {PACES.map(({ value, label, hint }) => (
          <Choice key={value} active={settings.pace === value} disabled={!editable} onClick={() => change({ pace: value })} hint={hint}>
            {label}
          </Choice>
        ))}
      </Row>

      <Row label="Rerolls">
        <Choice active={settings.rerolls} disabled={!editable} onClick={() => change({ rerolls: true })} hint="3 champs + 3 items">
          On
        </Choice>
        <Choice active={!settings.rerolls} disabled={!editable} onClick={() => change({ rerolls: false })} hint="What you roll is what you get">
          Off
        </Choice>
      </Row>

      <Row label="Live events">
        {EVENT_MODES.map(({ value, label }) => (
          <Choice key={value} active={settings.eventMode === value} disabled={!editable} onClick={() => onChange(withEventMode(settings, value))}>
            {label}
          </Choice>
        ))}
      </Row>

      {settings.eventMode === 'custom' && editable ? (
        <CustomGames settings={settings} onChange={onChange} />
      ) : (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-wrap gap-1.5" aria-label="Mini-games in this match">
            {settings.games.map((id) => (
              <GameChip key={id} id={id} bothRoles={settings.bothRoles} />
            ))}
          </ul>
          {editable && settings.eventMode !== 'custom' && (
            <button
              type="button"
              onClick={() => onChange(withEventMode(settings, settings.eventMode))}
              className="self-start rounded-md border border-gold/40 px-3 py-1 text-sm font-semibold text-gold-light/80 transition hover:border-gold active:scale-95"
            >
              🔀 Shuffle
            </button>
          )}
        </div>
      )}

      <label className={`flex items-start gap-2 text-sm ${editable ? 'cursor-pointer' : 'opacity-80'}`}>
        <input
          type="checkbox"
          checked={settings.bothRoles}
          disabled={!editable}
          onChange={(event) => change({ bothRoles: event.target.checked })}
          className="mt-0.5 size-4 accent-hextech"
        />
        <span>
          <span className="font-semibold text-gold-light">Both play both roles</span>
          <span className="block text-xs text-gold-light/60">
            In 2-chance games (hide/guess, plant/walk) each player gets each role. Still one event each.
            {!hasRoleGame && ' None of the chosen games has roles.'}
          </span>
        </span>
      </label>

      <label className={`flex items-start gap-2 text-sm ${editable ? 'cursor-pointer' : 'opacity-80'}`}>
        <input
          type="checkbox"
          checked={settings.animations}
          disabled={!editable}
          onChange={(event) => change({ animations: event.target.checked })}
          className="mt-0.5 size-4 accent-hextech"
        />
        <span>
          <span className="font-semibold text-gold-light">Finisher animations</span>
          <span className="block text-xs text-gold-light/60">After each live event, the winner's champion plays a finisher.</span>
        </span>
      </label>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-start gap-2">
      <span className="pt-1.5 text-xs font-semibold tracking-wider text-gold/80 uppercase">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

interface ChoiceProps {
  active: boolean
  disabled: boolean
  onClick: () => void
  hint?: string
  children: ReactNode
}

function Choice({ active, disabled, onClick, hint, children }: ChoiceProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={hint}
      className={`flex min-w-0 flex-col rounded-md border-2 px-3 py-1 text-left transition enabled:active:scale-95 ${
        active ? 'border-hextech bg-hextech/15 text-gold-light' : 'border-gold/25 text-gold-light/60 enabled:hover:border-gold/60'
      } disabled:cursor-default ${!active && disabled ? 'opacity-50' : ''}`}
    >
      <span className="font-display text-sm font-bold">{children}</span>
      {hint && <span className="text-[10px] leading-tight text-gold-light/60">{hint}</span>}
    </button>
  )
}

/** "1 chance": both do the same. "2 chances": a role game, both roles with the box ticked. */
function ChanceBadge({ id, bothRoles }: { id: MiniGameId; bothRoles: boolean }) {
  const roles = MINI_GAME_RULES[id].chances === 2
  return (
    <span
      className={`rounded px-1 text-[10px] font-bold whitespace-nowrap ${
        roles && bothRoles ? 'bg-hextech/25 text-hextech' : roles ? 'bg-gold/20 text-gold' : 'bg-gold-light/10 text-gold-light/60'
      }`}
    >
      {roles ? (bothRoles ? '2 chances: both roles' : '2 chances') : '1 chance'}
    </span>
  )
}

function GameChip({ id, bothRoles }: { id: MiniGameId; bothRoles: boolean }) {
  const info = MINI_GAMES[id]
  return (
    <motion.li
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex min-w-0 items-center gap-1.5 rounded-full border border-gold/30 bg-abyss/60 py-0.5 pr-2 pl-0.5"
    >
      <img src={championIconById(info.champion)} alt="" className="size-6 rounded-full" />
      <span className="text-xs font-semibold text-gold-light [overflow-wrap:anywhere]">{info.name}</span>
      <ChanceBadge id={id} bothRoles={bothRoles} />
    </motion.li>
  )
}

function CustomGames({ settings, onChange }: { settings: LobbySettings; onChange: (settings: LobbySettings) => void }) {
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Choose mini-games">
      {MINI_GAME_IDS.map((id) => {
        const on = settings.games.includes(id)
        const info = MINI_GAMES[id]
        return (
          <li key={id}>
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 p-1.5 transition ${
                on ? 'border-hextech/70 bg-hextech/10' : 'border-gold/20 opacity-70 hover:opacity-100'
              }`}
            >
              <input type="checkbox" checked={on} onChange={() => onChange(toggleGame(settings, id))} className="size-4 accent-hextech" />
              <img src={championIconById(info.champion)} alt="" className="size-7 rounded-full" />
              <span className="min-w-0 flex-1 text-xs font-semibold text-gold-light [overflow-wrap:anywhere]">{info.name}</span>
              <ChanceBadge id={id} bothRoles={settings.bothRoles} />
            </label>
          </li>
        )
      })}
    </ul>
  )
}
