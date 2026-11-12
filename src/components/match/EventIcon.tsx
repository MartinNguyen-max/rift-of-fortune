import { mapIconUrl } from '../../data'
import type { MatchEvent } from '../../game/match/types'
import { eventIcon } from './matchStyles'

interface EventIconProps {
  event: Pick<MatchEvent, 'kind' | 'tags' | 'dragon'>
  /** Tailwind size and text classes, e.g. "size-6 text-lg". */
  className?: string
}

/** The event's League minimap icon (towers, Baron, dragons...), or an emoji for kills and fights. */
export function EventIcon({ event, className = 'size-5 text-base' }: EventIconProps) {
  const source = eventIcon(event)
  if ('icon' in source) {
    return <img src={mapIconUrl(source.icon)} alt="" aria-hidden="true" className={`inline-block object-contain ${className}`} />
  }
  return (
    <span aria-hidden="true" className={`inline-flex items-center justify-center leading-none ${className}`}>
      {source.emoji}
    </span>
  )
}
