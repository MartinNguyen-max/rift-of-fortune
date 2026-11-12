import { useEffect } from 'react'
import { playSound } from '../../services/sound'

interface MatchSoundsProps {
  /** The big moment playing right now, or null. */
  fightIndex: number | null
  ended: boolean
  won: boolean
}

/** Plays a hit on every big moment and the Victory or Defeat stinger at the end. Renders nothing. */
export function MatchSounds({ fightIndex, ended, won }: MatchSoundsProps) {
  useEffect(() => {
    if (fightIndex !== null && !ended) playSound('big-moment')
  }, [fightIndex, ended])

  useEffect(() => {
    if (ended) playSound(won ? 'victory' : 'defeat')
  }, [ended, won])

  return null
}
