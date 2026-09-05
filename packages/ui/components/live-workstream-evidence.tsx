"use client"

import type { SessionProjection } from "@nessalabs/spec-ledger-client"
import Link from "next/link"
import type { ReactNode } from "react"
import { SpecSections } from "@/components/spec-sections"
import { AcceptanceProgress } from "@/components/acceptance-progress"
import { WorkstreamEvidence } from "@/components/workstream-evidence"
import { useSessionObservation } from "@/components/use-session-observation"

export function LiveWorkstreamEvidence({
  initial,
  workstreamId,
  history,
}: {
  initial: SessionProjection
  workstreamId: string
  history?: ReactNode
}) {
  const { data, state, observed } = useSessionObservation(initial, workstreamId)
  const session =
    data.session?.workstreamId === workstreamId ? data.session : initial.session

  if (!session) return null

  return (
    <div className="space-y-3">
      <p role="status" className="text-xs text-muted-foreground">
        {state === "disconnected"
          ? "Live updates disconnected · showing the last observation"
          : state === "loading"
            ? "Refreshing live evidence…"
            : "Live evidence connected"}
        {observed ? ` · ${observed}` : ""}
      </p>
      <AcceptanceProgress
        total={session.criteria.length}
        verified={session.evidenceCount}
        implemented={session.criteria.filter((criterion) => criterion.implemented).length}
        remaining={session.completion.reasons}
        historical={session.status === "done"}
        unmapped={session.criteria.filter(c => !c.claims.length).length}
      />
      <SpecSections title={session.title} evidence={<WorkstreamEvidence session={session} observedAt={data.observedAt} />} changes={<div className="space-y-6"><div>{history}</div>{session.activity.length > 0 && <section className="space-y-3"><h2 className="font-semibold">All updates</h2><ul className="space-y-3">{session.activity.map(item => <li key={item.id} className="rounded-lg border border-border p-4 text-sm"><p>{item.summary}</p><details className="mt-2 text-muted-foreground"><summary>Why this changed</summary><p>{item.reason}</p>{item.discovery && <p>{item.discovery.observation}</p>}<Link className="underline" href={`/turns/${item.id.split('/')[0]}`}>Open change</Link></details></li>)}</ul></section>}</div>} process={<p><Link className="underline" href={`/workflows/${workstreamId}`}>Open workflow and process details →</Link></p>} workflowHref={`/workflows/${workstreamId}`} />
    </div>
  )
}
