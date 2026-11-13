/** Ids shared between draggables, droppables and the drag-end handler. */
export const ROLLED_CHAMPION_ID = 'rolled-champion'
export const ITEM_POOL_ID = 'item-pool'

const ITEM_PREFIX = 'item:'

export const itemDragId = (itemId: string) => `${ITEM_PREFIX}${itemId}`

export function itemIdFromDragId(dragId: string | number): string | null {
  const id = String(dragId)
  return id.startsWith(ITEM_PREFIX) ? id.slice(ITEM_PREFIX.length) : null
}

const OFFER_PREFIX = 'offer:'

/** Fast pace: an offered champion being dragged onto a role. */
export const offerDragId = (championId: string) => `${OFFER_PREFIX}${championId}`

export function championIdFromOfferDragId(dragId: string | number): string | null {
  const id = String(dragId)
  return id.startsWith(OFFER_PREFIX) ? id.slice(OFFER_PREFIX.length) : null
}
