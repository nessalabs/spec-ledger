'use client'

import { useState, type ReactNode } from 'react'

/** Mount proof only when requested; opening a requirement never executes its check. */
export function EvidenceCard({ id, heading, children, defaultOpen = false }: { id: string; heading: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [mounted, setMounted] = useState(defaultOpen)
  return <details id={id} open={open} onToggle={event => { setOpen(event.currentTarget.open); if (event.currentTarget.open) setMounted(true) }} className="scroll-mt-6 rounded-xl border border-border">
    <summary className="cursor-pointer p-4 marker:text-muted-foreground">{heading}</summary>
    {mounted && <div className="space-y-4 border-t border-border p-4">{children}</div>}
  </details>
}
