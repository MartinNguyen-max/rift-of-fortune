import type { ReactNode } from 'react'
import type { Role } from '../data/types'
import { summonersRiftMapUrl } from '../data'
import { ROLE_MAP_POSITIONS, ROLES } from '../game/roles'

interface RiftMapProps {
  renderSlot: (role: Role) => ReactNode
  /** Leaves extra room for the taller item panel on phones. */
  compact?: boolean
}

export function RiftMap({ renderSlot, compact = false }: RiftMapProps) {
  return (
    <div
      className={`relative aspect-square w-full lg:max-w-xl ${
        compact ? 'max-w-[min(36rem,calc(100svh-23rem))]' : 'max-w-[min(36rem,calc(100svh-19rem))]'
      }`}
    >
      <img
        src={summonersRiftMapUrl}
        alt="Summoner's Rift"
        className="absolute inset-0 size-full rounded-xl border border-gold/40 object-cover opacity-70 shadow-2xl shadow-black"
      />
      {ROLES.map((role) => {
        const { x, y } = ROLE_MAP_POSITIONS[role]
        return (
          <div
            key={role}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {renderSlot(role)}
          </div>
        )
      })}
    </div>
  )
}
