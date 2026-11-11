import { useState } from 'react'
import { RiftMap } from './components/RiftMap'
import { RoleSlot } from './components/RoleSlot'
import { emptyTeam } from './game/team'

export default function App() {
  const [team] = useState(emptyTeam)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-4 py-6 text-center">
        <h1 className="text-3xl font-bold tracking-wide text-gold sm:text-4xl">LoL Rift Roulette</h1>
      </header>
      <main className="flex flex-1 justify-center px-4 pb-8">
        <RiftMap renderSlot={(role) => <RoleSlot role={role} champion={team[role]} />} />
      </main>
    </div>
  )
}
