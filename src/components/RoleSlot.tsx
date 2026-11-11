import { useDroppable } from '@dnd-kit/core'
import { championIconUrl } from '../data'
import type { Champion, Role } from '../data/types'
import { ROLE_LABELS } from '../game/roles'

interface RoleSlotProps {
  role: Role
  champion: Champion | null
  /** Set when a champion can be placed here; enables drop and click. */
  onPlace?: () => void
}

export function RoleSlot({ role, champion, onPlace }: RoleSlotProps) {
  const { setNodeRef, isOver } = useDroppable({ id: role, disabled: !onPlace })
  const canPlace = onPlace !== undefined

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onPlace}
      disabled={!canPlace}
      aria-label={champion ? `${ROLE_LABELS[role]}: ${champion.name}` : `Place in ${ROLE_LABELS[role]}`}
      className="group flex flex-col items-center gap-1 disabled:cursor-default"
    >
      <div
        className={`flex size-14 items-center justify-center overflow-hidden rounded-full border-2 bg-panel/80 transition sm:size-16 ${
          champion ? 'border-gold' : 'border-dashed border-gold/50'
        } ${canPlace ? 'animate-pulse border-hextech group-hover:scale-110' : ''} ${
          isOver ? 'scale-125 border-solid border-hextech bg-hextech/30' : ''
        }`}
      >
        {champion ? (
          <img src={championIconUrl(champion.image)} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-xl text-gold/50">+</span>
        )}
      </div>
      <span className="rounded bg-abyss/80 px-1.5 text-xs font-semibold tracking-wide text-gold uppercase">
        {champion ? champion.name : ROLE_LABELS[role]}
      </span>
    </button>
  )
}
