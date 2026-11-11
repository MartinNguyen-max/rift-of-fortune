import { gameData } from '../data'

export function Footer() {
  return (
    <footer className="border-t border-gold/20 px-4 py-6 text-center text-xs text-gold-light/50">
      <p className="mx-auto max-w-3xl">
        LoL Rift Roulette isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot
        Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all
        associated properties are trademarks or registered trademarks of Riot Games, Inc.
      </p>
      <p className="mt-2">
        Data from Riot Data Dragon (patch {gameData.patch}), Meraki Analytics and CommunityDragon. A free fan project.
      </p>
    </footer>
  )
}
