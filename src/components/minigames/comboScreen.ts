import { useEffect } from 'react'
import { toComboKey, type ComboKey } from '../../game/minigames/combo'

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
