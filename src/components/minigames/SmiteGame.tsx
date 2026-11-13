import type { MiniGameViewProps, RevealProps, TutorialArtProps } from './types'

// Placeholder while the screen is being built.
export function SmiteGame(props: MiniGameViewProps) {
  return <p>{props.players[props.me].name}</p>
}

export function SmiteTutorialArt({ step }: TutorialArtProps) {
  return <p>{step}</p>
}

export function SmiteReveal({ settled }: RevealProps) {
  return <p>{settled.scores.join(' – ')}</p>
}
