import { seededRandom, type RandomFn } from '../random'

/** First to this many rounds wins the duel (best of 3). */
export const DUEL_ROUNDS_TO_WIN = 2

/** Seconds of "Ready... Steady..." before DRAW, picked at random so it can't be timed. */
export const DRAW_DELAY = { min: 1.8, max: 4.8 } as const

/** The bot's reaction time in seconds after DRAW. A good human reacts in about 0.25 s. */
export const BOT_REACTION = { min: 0.26, max: 0.42 } as const

/** How often the bot gets nervous and shoots before DRAW. */
export const BOT_FALSE_START_CHANCE = 0.08

/** One round of the duel, decided up front from the seed. All times in seconds from the round start. */
export interface DuelRound {
  drawAt: number
  /** When the bot shoots: after DRAW, or before it on a false start. */
  botShotAt: number
}

const between = (min: number, max: number, random: RandomFn) => min + random() * (max - min)

/** Enough rounds for a best of 3. */
export function duelRounds(seed: number): DuelRound[] {
  const random = seededRandom(seed)
  return Array.from({ length: DUEL_ROUNDS_TO_WIN * 2 - 1 }, () => {
    const drawAt = between(DRAW_DELAY.min, DRAW_DELAY.max, random)
    const falseStart = random() < BOT_FALSE_START_CHANCE
    const botShotAt = falseStart
      ? drawAt - between(0.3, 0.9, random)
      : drawAt + between(BOT_REACTION.min, BOT_REACTION.max, random)
    return { drawAt, botShotAt }
  })
}

export type DuelRoundReason = 'faster' | 'slower' | 'player-early' | 'bot-early'

export interface DuelRoundResult {
  winner: 'player' | 'bot'
  reason: DuelRoundReason
  /** Seconds from DRAW to the player's shot, when they shot after DRAW. */
  playerReaction: number | null
  /** Seconds from DRAW to the bot's shot, when it shot after DRAW. */
  botReaction: number | null
}

/** When the round is over if the player never shoots: the bot's shot ends it. */
export const roundEndsAt = (round: DuelRound): number => round.botShotAt

/**
 * Whoever shoots first after DRAW wins the round. Shooting before DRAW loses it, so the first
 * one to jump the gun loses. `playerShotAt` is null if the player never shot.
 */
export function duelRoundResult(round: DuelRound, playerShotAt: number | null): DuelRoundResult {
  const botEarly = round.botShotAt < round.drawAt
  const botReaction = botEarly ? null : round.botShotAt - round.drawAt
  const playerFirst = playerShotAt !== null && playerShotAt < round.botShotAt
  const playerReaction = playerShotAt !== null && playerShotAt >= round.drawAt ? playerShotAt - round.drawAt : null

  if (playerFirst && playerShotAt < round.drawAt) {
    return { winner: 'bot', reason: 'player-early', playerReaction: null, botReaction: null }
  }
  if (botEarly && !playerFirst) {
    return { winner: 'player', reason: 'bot-early', playerReaction: null, botReaction: null }
  }
  return playerFirst
    ? { winner: 'player', reason: 'faster', playerReaction, botReaction }
    : { winner: 'bot', reason: 'slower', playerReaction, botReaction }
}

/** The duel winner once someone has won enough rounds, otherwise null. */
export function duelWinner(results: readonly DuelRoundResult[]): 'player' | 'bot' | null {
  for (const side of ['player', 'bot'] as const) {
    if (results.filter((result) => result.winner === side).length >= DUEL_ROUNDS_TO_WIN) return side
  }
  return null
}

/** The player's best reaction in the duel, in whole milliseconds. */
export function bestReactionMs(results: readonly DuelRoundResult[], side: 'player' | 'bot'): number | null {
  const times = results
    .map((result) => (side === 'player' ? result.playerReaction : result.botReaction))
    .filter((time): time is number => time !== null)
  return times.length > 0 ? Math.round(Math.min(...times) * 1000) : null
}
