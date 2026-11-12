import { useState } from 'react'
import { Button } from './Button'

/** Copies `text` to the clipboard. If that fails, shows the text so it can be copied by hand. */
export function ShareButton({ text, label = 'Share result' }: { text: string; label?: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  const share = () => {
    navigator.clipboard.writeText(text).then(
      () => setStatus('copied'),
      () => setStatus('failed'),
    )
  }

  return (
    <>
      <Button onClick={share}>{status === 'copied' ? 'Copied!' : label}</Button>
      {status === 'failed' && (
        <pre className="w-full rounded border border-gold/30 bg-abyss/60 p-2 text-left text-xs whitespace-pre-wrap text-gold-light/80 select-all">
          {text}
        </pre>
      )}
    </>
  )
}
