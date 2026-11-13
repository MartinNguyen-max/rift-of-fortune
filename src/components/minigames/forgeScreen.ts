import { useCallback, useEffect, useRef, useState } from 'react'
import type { Item, ItemComponent } from '../../data/types'
import { forgeableItems } from '../../game/minigames/forge'

/**
 * Seconds on your forge clock. It stops while `running` is false (the "FORGED!" moment)
 * and goes on from there. `read()` gives the exact time at a tap, not the last frame's.
 */
export function useForgeClock(running: boolean) {
  const [seconds, setSeconds] = useState(0)
  const banked = useRef(0)
  const since = useRef<number | null>(null)
  const read = useCallback(
    () => banked.current + (since.current === null ? 0 : (performance.now() - since.current) / 1000),
    [],
  )

  useEffect(() => {
    if (!running) return
    since.current = performance.now()
    let frame = requestAnimationFrame(function tick() {
      setSeconds(read())
      frame = requestAnimationFrame(tick)
    })
    return () => {
      cancelAnimationFrame(frame)
      banked.current = read()
      since.current = null
    }
  }, [running, read])

  return { seconds, read }
}

export interface Offset {
  x: number
  y: number
}

/** How far the middle of `from` is from the middle of `to`: where a part flies in from. */
export function offsetBetween(from: Element, to: Element | undefined): Offset {
  if (!to) return { x: 0, y: 0 }
  const start = from.getBoundingClientRect()
  const end = to.getBoundingClientRect()
  return {
    x: start.left + start.width / 2 - (end.left + end.width / 2),
    y: start.top + start.height / 2 - (end.top + end.height / 2),
  }
}

/** Columns for a tray of parts: one row up to 4, then two even rows (6 as 3 + 3, 7 as 4 + 3). */
export const trayColumns = (parts: number): number => (parts <= 4 ? Math.max(1, parts) : Math.ceil(parts / 2))

export interface ForgeTutorialPicks {
  /** The item to build, Infinity Edge when the data has it. */
  item: Item | undefined
  /** Two of its parts. */
  parts: ItemComponent[]
  /** A part it doesn't need. */
  decoy: ItemComponent | undefined
  /** Three items for "3 items", starting with `item`. */
  items: Item[]
}

/** Real items and parts for the tutorial pictures. */
export function forgeTutorialPicks(items: readonly Item[], components: readonly ItemComponent[]): ForgeTutorialPicks {
  const buildable = forgeableItems(items, components)
  const item = buildable.find(({ name }) => name === 'Infinity Edge') ?? buildable[0]
  const recipe = item?.from ?? []
  return {
    item,
    parts: recipe.slice(0, 2).flatMap((id) => components.find((component) => component.id === id) ?? []),
    decoy: components.find(({ id }) => !recipe.includes(id)),
    items: [...(item ? [item] : []), ...buildable.filter((other) => other !== item)].slice(0, 3),
  }
}
