/** Tailwind text colour for a 0–100 score. */
export function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-400'
  if (score >= 50) return 'text-gold'
  return 'text-red-400'
}
