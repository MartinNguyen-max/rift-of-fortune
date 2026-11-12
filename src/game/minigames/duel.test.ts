import { describe, expect, it } from 'vitest'
import { BOT_REACTION, bestReactionMs, DRAW_DELAY, duelRoundResult, duelRounds, duelWinner, type DuelRound } from './duel'

const round: DuelRound = { drawAt: 3, botShotAt: 3.3 }
const earlyBot: DuelRound = { drawAt: 3, botShotAt: 2.5 }

describe('duelRounds', () => {
  it('is the same for the same seed and has enough rounds for a best of 3', () => {
    expect(duelRounds(7)).toEqual(duelRounds(7))
    expect(duelRounds(7)).toHaveLength(3)
  })

  it('draws within the delay range and the bot shoots in its reaction range or early', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const { drawAt, botShotAt } of duelRounds(seed)) {
        expect(drawAt).toBeGreaterThanOrEqual(DRAW_DELAY.min)
        expect(drawAt).toBeLessThanOrEqual(DRAW_DELAY.max)
        const reaction = botShotAt - drawAt
        expect(reaction < 0 || (reaction >= BOT_REACTION.min && reaction <= BOT_REACTION.max)).toBe(true)
      }
    }
  })
})

describe('duelRoundResult', () => {
  it('gives the round to the player who shoots before the bot, after DRAW', () => {
    expect(duelRoundResult(round, 3.2)).toMatchObject({ winner: 'player', reason: 'faster' })
    expect(duelRoundResult(round, 3.2).playerReaction).toBeCloseTo(0.2)
  })

  it('gives the round to the bot when the player is slower or never shoots', () => {
    expect(duelRoundResult(round, 3.4)).toMatchObject({ winner: 'bot', reason: 'slower' })
    expect(duelRoundResult(round, null)).toMatchObject({ winner: 'bot', reason: 'slower', playerReaction: null })
  })

  it('makes the player lose for shooting before DRAW', () => {
    expect(duelRoundResult(round, 2.9)).toMatchObject({ winner: 'bot', reason: 'player-early' })
  })

  it('makes the bot lose for shooting before DRAW, unless the player jumped the gun first', () => {
    expect(duelRoundResult(earlyBot, null)).toMatchObject({ winner: 'player', reason: 'bot-early' })
    expect(duelRoundResult(earlyBot, 2.7)).toMatchObject({ winner: 'player', reason: 'bot-early' })
    expect(duelRoundResult(earlyBot, 2.2)).toMatchObject({ winner: 'bot', reason: 'player-early' })
  })
})

describe('duelWinner', () => {
  const win = duelRoundResult(round, 3.1)
  const loss = duelRoundResult(round, null)

  it('needs 2 round wins', () => {
    expect(duelWinner([win])).toBeNull()
    expect(duelWinner([win, loss])).toBeNull()
    expect(duelWinner([win, loss, win])).toBe('player')
    expect(duelWinner([loss, loss])).toBe('bot')
  })

  it('reports the best reaction in milliseconds', () => {
    expect(bestReactionMs([win, duelRoundResult(round, 3.25)], 'player')).toBe(100)
    expect(bestReactionMs([loss], 'player')).toBeNull()
    expect(bestReactionMs([loss], 'bot')).toBe(300)
  })
})
