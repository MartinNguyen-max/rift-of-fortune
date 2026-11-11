type Tone = 'good' | 'ok' | 'bad'

function scoreTone(score: number): Tone {
  if (score >= 75) return 'good'
  if (score >= 50) return 'ok'
  return 'bad'
}

const TEXT: Record<Tone, string> = { good: 'text-emerald-400', ok: 'text-gold', bad: 'text-red-400' }
const BORDER: Record<Tone, string> = { good: 'border-emerald-400', ok: 'border-gold', bad: 'border-red-400' }

/** Tailwind text colour for a 0–100 score. */
export const scoreColor = (score: number): string => TEXT[scoreTone(score)]

/** Tailwind border colour for a 0–100 score. */
export const scoreBorderColor = (score: number): string => BORDER[scoreTone(score)]
