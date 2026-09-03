"use client"

import * as React from "react"
import type { RelatedDoc } from "@/components/turn-detail"
import { useDocPane } from "@/components/doc-reader"

export { useDocPane } from "@/components/doc-reader"

/**
 * Registers page docs with the shell reader and wraps content.
 * Split/tabs live in SpecLedgerShell so they survive navigation.
 */
export function TurnDocSplit({
  docs,
  children,
}: {
  docs: RelatedDoc[]
  children: React.ReactNode
}) {
  const { registerDocs } = useDocPane()

  React.useEffect(() => {
    registerDocs(
      docs.map((d) => ({
        path: d.path,
        label: d.label,
        content: d.content,
      })),
    )
  }, [docs, registerDocs])

  return <div className="mx-auto max-w-5xl">{children}</div>
}

export function RelatedDocsList({ docs }: { docs: RelatedDoc[] }) {
  const { openDoc, openPath, registerDocs } = useDocPane()

  React.useEffect(() => {
    registerDocs(docs)
  }, [docs, registerDocs])

  if (!docs.length) return null

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Related docs</h2>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {docs.map((d) => {
          const canOpen = Boolean(d.content) || Boolean(d.path)
          const active = openPath === d.path
          return (
            <li
              key={d.path}
              className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="font-medium text-foreground">{d.label}</span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                  {d.path}
                </span>
              </span>
              <button
                type="button"
                disabled={!canOpen}
                onClick={() =>
                  openDoc({
                    path: d.path,
                    label: d.label,
                    content: d.content,
                  })
                }
                className={
                  canOpen
                    ? "shrink-0 font-medium underline-offset-4 hover:underline"
                    : "shrink-0 cursor-not-allowed opacity-50"
                }
              >
                {active ? "Open" : "Read"}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
