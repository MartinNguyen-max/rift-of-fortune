import type { Phase } from '../game/gameState'

const STEPS: { phase: Phase; label: string }[] = [
  { phase: 'draft', label: 'Draft' },
  { phase: 'items', label: 'Items' },
  { phase: 'results', label: 'Rating' },
]

export function PhaseSteps({ current }: { current: Phase }) {
  const currentIndex = STEPS.findIndex(({ phase }) => phase === current)

  return (
    <ol className="mb-6 flex items-center justify-center gap-2 text-xs font-semibold tracking-widest uppercase">
      {STEPS.map(({ phase, label }, index) => (
        <li key={phase} className="flex items-center gap-2">
          {index > 0 && <span className={`h-px w-6 ${index <= currentIndex ? 'bg-gold' : 'bg-gold/20'}`} />}
          <span
            aria-current={index === currentIndex ? 'step' : undefined}
            className={
              index === currentIndex ? 'text-hextech' : index < currentIndex ? 'text-gold' : 'text-gold-light/30'
            }
          >
            {index + 1}. {label}
          </span>
        </li>
      ))}
    </ol>
  )
}
