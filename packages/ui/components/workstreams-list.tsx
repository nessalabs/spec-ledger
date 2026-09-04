"use client"

import type { Workstream } from "@nessalabs/spec-ledger-client"
import {
  PeekLink,
  workstreamPeekMarkdown,
} from "@/components/peek-link"

export function WorkstreamsList({ workstreams }: { workstreams: Workstream[] }) {
  const ordered = [...workstreams].sort((a, b) => b.id.localeCompare(a.id))

  if (ordered.length === 0) {
    return <p className="text-sm text-muted-foreground">No workstreams yet.</p>
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {ordered.map((w) => {
        const blurb = w.objective?.trim() || w.problem
        const peek = workstreamPeekMarkdown({
          id: w.id,
          title: w.title,
          objective: blurb,
          status: w.status,
          revision: w.seal?.revision,
        })
        return (
          <li key={w.id}>
            <PeekLink
              href={`/workstreams/${w.id}`}
              peekPath={`peek:workstream/${w.id}`}
              peekLabel={w.id}
              peekContent={peek}
              title="⌘/Ctrl-click to peek beside the list"
              className="grid gap-0.5 px-3 py-2.5 no-underline transition-colors hover:bg-muted/40 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-3"
            >
              <span className="font-mono text-xs font-semibold text-foreground">
                {w.id}
              </span>
              <span className="min-w-0">
                <span className="line-clamp-1 text-sm font-medium text-foreground">
                  {w.title}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[11px] text-muted-foreground">
                  {blurb}
                </span>
              </span>
              <span className="shrink-0 text-[11px] capitalize text-muted-foreground">
                {w.status}
                {w.seal ? ` · rev ${w.seal.revision}` : ""}
              </span>
            </PeekLink>
          </li>
        )
      })}
    </ul>
  )
}
