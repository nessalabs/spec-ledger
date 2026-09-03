"use client"

import { useDocPane } from "@/components/turn-doc-split"

/** Compact pitch row: path + Read opens SplitView (no inline Markdown). */
export function PitchDocLink({
  path,
  title,
}: {
  path: string
  title?: string
}) {
  const { openDoc, openPath } = useDocPane()
  const open = openPath === path

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Pitch</h2>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5">
        <div className="min-w-0 flex-1">
          {title ? (
            <p className="text-sm font-medium text-foreground">{title}</p>
          ) : null}
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {path}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            openDoc({
              path,
              label: title ?? path.split("/").pop() ?? path,
            })
          }
          className="shrink-0 text-sm font-medium underline-offset-4 hover:underline"
        >
          {open ? "Open" : "Read"}
        </button>
      </div>
    </section>
  )
}
