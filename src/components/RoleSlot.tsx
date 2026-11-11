import type { Champion, Role } from '../data/types'
import { championIconUrl } from '../data'
import { ROLE_LABELS } from '../game/roles'

interface RoleSlotProps {
  role: Role
  champion: Champion | null
}

export function RoleSlot({ role, champion }: RoleSlotProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex size-14 items-center justify-center overflow-hidden rounded-full border-2 bg-panel/80 sm:size-16 ${
          champion ? 'border-gold' : 'border-dashed border-gold/50'
        }`}
      >
        {champion ? (
          <img src={championIconUrl(champion.image)} alt={champion.name} className="size-full object-cover" />
        ) : (
          <span className="text-xl text-gold/50">+</span>
        )}
      </div>
      <span className="rounded bg-abyss/80 px-1.5 text-xs font-semibold tracking-wide text-gold uppercase">
        {champion ? champion.name : ROLE_LABELS[role]}
      </span>
    </div>
  )
}
