import { useCallback, useMemo, useState } from 'react'
import { DailyResult } from '../components/DailyResult'
import { Game } from '../components/Game'
import { gameData } from '../data'
import type { Champion } from '../data/types'
import { dailyNumber, dailyRolls, dateKey } from '../game/daily'
import { rollChampion } from '../game/draft'
import type { GameState } from '../game/gameState'
import { ROLES } from '../game/roles'
import { emptyRoles } from '../game/team'
import { loadDaily, saveDaily } from '../services/dailyProgress'

/** Same champions and items for everyone today, one try. */
export function DailyPage() {
  const [today] = useState(() => new Date())
  const date = dateKey(today)
  const number = dailyNumber(today)
  const rolls = useMemo(() => dailyRolls(gameData, today), [today])
  const [initialState] = useState(() => loadDaily(date))

  const nextChampion = useCallback(
    (state: GameState): Champion => {
      const picked = ROLES.length - emptyRoles(state.team).length
      return rolls.champions[picked] ?? rollChampion(gameData.champions, state.team)
    },
    [rolls],
  )
  const drawItems = useCallback(() => rolls.items, [rolls])
  const save = useCallback((state: GameState) => saveDaily(date, state), [date])

  return (
    <Game
      title={`Daily Rift #${number}`}
      initialState={initialState}
      nextChampion={nextChampion}
      drawItems={drawItems}
      onStateChange={save}
      resultActions={(rating) => <DailyResult number={number} rating={rating} />}
    />
  )
}
