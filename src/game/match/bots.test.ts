import { describe, expect, it } from 'vitest'
import { gameData } from '../../data'
import { seededRandom } from '../random'
import { rankFor } from '../scoring/rank'
import { percentile } from '../scoring/simulate'
import { BOT_PROFILES, createBotTeam, isBotLevel, type BotLevel } from './bots'

const GAMES = 600

function medianTier(level: BotLevel) {
  const random = seededRandom(level)
  const scores = Array.from({ length: GAMES }, () => createBotTeam(gameData, level, [], random).rating.score).sort(
    (a, b) => a - b,
  )
  return rankFor(percentile(scores, 0.5)).tier
}

describe('createBotTeam', () => {
  it('drafts a full team with a name from its level', () => {
    const team = createBotTeam(gameData, 2, [], seededRandom(1))
    expect(team.rating.champions).toHaveLength(5)
    expect(BOT_PROFILES[2].names).toContain(team.name)
  })

  it("never picks a champion from the player's team", () => {
    const taken = gameData.champions.slice(0, 150).map(({ id }) => id)
    for (let seed = 0; seed < 50; seed++) {
      const team = createBotTeam(gameData, 3, taken, seededRandom(seed))
      for (const { champion } of team.rating.champions) expect(taken).not.toContain(champion.id)
    }
  })

  it('is reproducible with the same seed', () => {
    expect(createBotTeam(gameData, 3, [], seededRandom(9))).toEqual(createBotTeam(gameData, 3, [], seededRandom(9)))
  })
})

/** Guards the difficulty steps between the levels. */
describe('bot difficulty', () => {
  it('puts level 1 in Iron or Bronze on average', () => {
    expect(['Iron', 'Bronze']).toContain(medianTier(1))
  })

  it('puts level 2 in Gold or Platinum on average', () => {
    expect(['Gold', 'Platinum']).toContain(medianTier(2))
  })

  it('puts level 3 in Emerald or higher on average', () => {
    expect(['Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger']).toContain(medianTier(3))
  })
})

describe('isBotLevel', () => {
  it('accepts 1–3 only', () => {
    expect([1, 2, 3].every(isBotLevel)).toBe(true)
    expect([0, 4, '1', null].some(isBotLevel)).toBe(false)
  })
})
