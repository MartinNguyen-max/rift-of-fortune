import type { ButtonHTMLAttributes } from 'react'

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`rounded-md border-2 border-gold bg-panel px-6 py-2.5 font-bold tracking-wider text-gold-light uppercase transition hover:bg-gold/20 hover:shadow-lg hover:shadow-gold/20 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    />
  )
}
