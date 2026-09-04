"use client"

import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nessalabs/ui"
import type { Workstream } from "@nessalabs/spec-ledger-client"
import { useDocPane } from "@/components/turn-doc-split"

/** Plan: workstream + slice + doc path with Read → SplitView pane (no inline pitch). */
export function TurnPlanSection({
  workstream,
  sliceTitle,
  planMarkdown,
  planPath,
  userPrompt,
}: {
  workstream?: Workstream | null
  sliceTitle?: string
  planMarkdown?: string | null
  planPath?: string | null
  userPrompt: string
}) {
  const { openPath, openDoc } = useDocPane()
  const canRead = Boolean(planPath && planMarkdown)
  const open = Boolean(planPath && openPath === planPath)

  if (!workstream && !userPrompt && !planMarkdown) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">Plan</h2>
      {workstream || canRead ? (
        <Card>
          <CardHeader className="gap-1">
            <CardTitle className="text-base">
              {workstream?.title ?? "Workstream pitch"}
            </CardTitle>
            <CardDescription>
              {workstream ? (
                <Link
                  href={`/workstreams/${encodeURIComponent(workstream.id)}`}
                  className="hover:underline"
                >
                  {workstream.id}
                </Link>
              ) : null}
              {sliceTitle ? ` · ${sliceTitle}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {canRead && planPath ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/80 px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                  {planPath}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    openDoc({
                      path: planPath,
                      label: workstream?.title ?? "Workstream pitch",
                      content: planMarkdown,
                    })
                  }
                  className="shrink-0 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {open ? "Open" : "Read"}
                </button>
              </div>
            ) : workstream ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-1 text-xs font-medium text-muted-foreground">
                    Before
                  </h3>
                  <p className="leading-relaxed text-foreground/90">
                    {workstream.problem}
                  </p>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-medium text-muted-foreground">
                    After
                  </h3>
                  <p className="leading-relaxed text-foreground/90">
                    {workstream.objective}
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ask</CardTitle>
          <CardDescription>What opened this turn.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{userPrompt}</p>
        </CardContent>
      </Card>
    </section>
  )
}
