import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useCallback, useReducer } from 'react'
import { DraftPanel } from './components/DraftPanel'
import { RiftMap } from './components/RiftMap'
import { RoleSlot } from './components/RoleSlot'
import { ROLLED_CHAMPION_ID } from './components/RolledChampionCard'
import { gameData } from './data'
import type { Role } from './data/types'
import { rollChampion } from './game/draft'
import { canPlace, canRoll, gameReducer, initialGameState } from './game/gameState'
import { isRole } from './game/roles'
import { emptyRoles } from './game/team'

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, initialGameState)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const reveal = useCallback(() => dispatch({ type: 'reveal' }), [])
  const roll = () => dispatch({ type: 'roll', champion: rollChampion(gameData.champions, state.team) })
  const place = (role: Role) => dispatch({ type: 'place', role })

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (active.id === ROLLED_CHAMPION_ID && isRole(over?.id)) place(over.id)
  }

  const pickNumber = 6 - emptyRoles(state.team).length

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex min-h-screen flex-col">
        <header className="px-4 py-6 text-center">
          <h1 className="text-3xl font-bold tracking-wide text-gold sm:text-4xl">LoL Rift Roulette</h1>
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-8 px-4 pb-8 lg:flex-row lg:items-start lg:justify-center">
          <RiftMap
            renderSlot={(role) => (
              <RoleSlot
                role={role}
                champion={state.team[role]}
                onPlace={canPlace(state, role) ? () => place(role) : undefined}
              />
            )}
          />
          <div className="w-full max-w-sm rounded-xl border border-gold/30 bg-panel/60 p-6">
            {state.phase === 'draft' && (
              <DraftPanel
                rolled={state.rolled}
                pickNumber={Math.min(pickNumber, 5)}
                canRoll={canRoll(state)}
                onRoll={roll}
                onRevealed={reveal}
              />
            )}
          </div>
        </main>
      </div>
    </DndContext>
  )
}
