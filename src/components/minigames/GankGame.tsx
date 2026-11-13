import type { MiniGameViewProps, RevealProps, TutorialArtProps } from './types'

// Placeholder while the screen is being built.
export function GankGame(props: MiniGameViewProps) {
  return <p>{props.players[props.me].name}</p>
}

export function GankTutorialArt({ step }: TutorialArtProps) {
  return <p>{step}</p>
}

export function GankReveal({ settled }: RevealProps) {
  return <p>{settled.scores.join(' – ')}</p>
}
