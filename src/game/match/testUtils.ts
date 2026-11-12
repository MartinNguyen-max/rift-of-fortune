import { gameData } from '../../data'
import { seededRandom } from '../random'
import { rateTeam } from '../scoring/rateTeam'
import { simulateGame } from '../scoring/simulate'
import type { MatchEvent, MatchTeams, Scoreboard } from './types'

/** Two real teams: a sensible blue team and a randomly drafted red team. */
export function sampleTeams(seed = 1): MatchTeams {
  const random = seededRandom(seed)
  return {
    blue: { name: 'Your team', rating: rateTeam(simulateGame(gameData, 'sensible', random)) },
    red: { name: 'Team Bot', rating: rateTeam(simulateGame(gameData, 'random', random)) },
  }
}

const emptyScore = (): Scoreboard => ({
  blue: { kills: 0, towers: 0, dragons: 0, barons: 0, inhibitors: 0, gold: 2500 },
  red: { kills: 0, towers: 0, dragons: 0, barons: 0, inhibitors: 0, gold: 2500 },
})

export function makeEvent(overrides: Partial<MatchEvent> = {}): MatchEvent {
  return {
    time: 600,
    kind: 'tower',
    side: 'blue',
    actor: null,
    target: null,
    fightKills: null,
    kills: [],
    dragon: null,
    tags: [],
    big: false,
    spot: 'mid',
    score: emptyScore(),
    ...overrides,
  }
}
