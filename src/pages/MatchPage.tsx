import { useState } from 'react'
import { Game } from '../components/Game'
import { MatchView } from '../components/match/MatchView'
import { gameData } from '../data'
import { rollChampion } from '../game/draft'
import type { GameState } from '../game/gameState'
import { drawItems } from '../game/items'
import { BOT_LEVELS, BOT_PROFILES, createBotTeam, type BotLevel } from '../game/match/bots'
import { PLAYER_TEAM_NAME } from '../game/match/commentary'
import type { MatchTeams } from '../game/match/types'
import { seededRandom } from '../game/random'
import type { TeamRating } from '../game/scoring/rateTeam'

const nextChampion = (state: GameState) => rollChampion(gameData.champions, state.team)
const randomItems = () => drawItems(gameData.items)
const newSeed = () => Math.floor(Math.random() * 2 ** 32)

type View = { kind: 'draft' } | { kind: 'match'; teams: MatchTeams; level: BotLevel; seed: number }

/** Draft a team with the Classic rules, then send it into a simulated match against a bot. */
export function MatchPage() {
  const [view, setView] = useState<View>({ kind: 'draft' })

  const startMatch = (rating: TeamRating, level: BotLevel) => {
    const seed = newSeed()
    const taken = rating.champions.map(({ champion }) => champion.id)
    const bot = createBotTeam(gameData, level, taken, seededRandom(seed))
    setView({ kind: 'match', level, seed, teams: { blue: { name: PLAYER_TEAM_NAME, rating }, red: bot } })
    window.scrollTo({ top: 0 })
  }

  if (view.kind === 'match') {
    return (
      <MatchView
        key={view.seed}
        teams={view.teams}
        level={view.level}
        seed={view.seed}
        onRematch={(level) => startMatch(view.teams.blue.rating, level)}
        onNewTeam={() => setView({ kind: 'draft' })}
      />
    )
  }

  return (
    <Game
      title="Match vs Bots"
      nextChampion={nextChampion}
      drawItems={randomItems}
      resultActions={(rating, reset) => <BotPicker onPick={(level) => startMatch(rating, level)} onRedraft={reset} />}
    />
  )
}

function BotPicker({ onPick, onRedraft }: { onPick: (level: BotLevel) => void; onRedraft: () => void }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <p className="font-display text-sm font-bold tracking-wider text-gold uppercase">Choose your opponent</p>
      {BOT_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onPick(level)}
          className="rounded-lg border-2 border-gold/40 bg-panel px-4 py-2 text-left transition hover:border-gold hover:bg-gold/10"
        >
          <span className="block font-display font-bold text-gold-light">{BOT_PROFILES[level].label}</span>
          <span className="block text-xs text-gold-light/70">{BOT_PROFILES[level].description}</span>
        </button>
      ))}
      <button type="button" onClick={onRedraft} className="mt-1 text-sm text-hextech underline-offset-4 hover:underline">
        Draft a different team
      </button>
    </div>
  )
}
