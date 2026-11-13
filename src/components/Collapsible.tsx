import type { ReactNode } from 'react'

interface CollapsibleProps {
  title: string
  /** Closed unless set. */
  open?: boolean
  children: ReactNode
}

/** A section that stays closed until tapped, for details most players skip. */
export function Collapsible({ title, open = false, children }: CollapsibleProps) {
  return (
    <details open={open} className="group rounded-xl border border-gold/20 bg-abyss/50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-gold-light/80 select-none hover:text-gold-light [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden="true" className="text-gold transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="px-2 pb-2">{children}</div>
    </details>
  )
}
