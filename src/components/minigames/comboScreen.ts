import { useEffect } from 'react'
import { rightKeys, toComboKey, type ComboKey } from '../../game/minigames/combo'

/** Calls `onPress` for Q, W, E or R on the keyboard (any case), for players on a keyboard. */
export function useComboKeys(onPress: (key: ComboKey) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      const key = toComboKey(event.key)
      if (!key || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      event.preventDefault()
      onPress(key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPress, enabled])
}

/** Multiplayer: right keys over every spam typed so far. */
export const liveScore = (spams: readonly (readonly ComboKey[])[], typed: readonly (readonly ComboKey[])[]): number =>
  spams.reduce((total, spam, round) => total + rightKeys(spam, typed[round] ?? []), 0)
