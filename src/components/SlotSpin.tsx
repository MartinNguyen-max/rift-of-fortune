import { useSpin } from './useSpin'

/** A quick spin for rerolls: about half a second, much shorter than the main roll. */
const SPIN_FRAMES = 8
const spinDelayMs = (frame: number) => 25 + frame * frame * 1.5

interface SlotSpinProps<T> {
  target: T
  pool: readonly T[]
  imageUrl: (value: T) => string
  onLanded: () => void
  className: string
}

/** Flashes random icons in place, then lands on the new champion or item. */
export function SlotSpin<T>({ target, pool, imageUrl, onLanded, className }: SlotSpinProps<T>) {
  const { frame, landed } = useSpin({ target, pool, spinFrames: SPIN_FRAMES, delayMs: spinDelayMs, imageUrl, onLanded })
  return frame ? (
    <img src={imageUrl(frame)} alt="" className={`${className} ${landed ? '' : 'blur-[0.5px] brightness-125'}`} draggable={false} />
  ) : null
}
