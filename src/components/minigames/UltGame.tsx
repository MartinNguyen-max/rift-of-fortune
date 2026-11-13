import type { MiniGameViewProps, TutorialArtProps } from './types'

// Placeholder while the screen is being built.
export function UltGame(props: MiniGameViewProps) {
  return <p>{props.players[props.me].name}</p>
}

export function UltTutorialArt({ step }: TutorialArtProps) {
  return <p>{step}</p>
}
