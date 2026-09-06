"use client"

import type { SessionProjection } from "@nessalabs/spec-ledger-client"
import { TaskUpdates } from "@/components/task-updates"
import type { ReactNode } from "react"
import { LiveWorkflow } from "@/components/live-workflow"
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
            : "Live"}
        {observed ? ` · ${observed}` : ""}
      </p>
      <AcceptanceProgress
        total={session.criteria.length}
        verified={session.evidenceCount}
        implemented={session.criteria.filter((criterion) => criterion.implemented).length}
        remaining={session.completion.reasons}
            checklist={session.completion.checklist}
            completionEligible={session.completion.eligible}
        historical={session.status === "done"}
        unmapped={session.criteria.filter(c => !c.claims.length).length}
      />
      <SpecSections
        title={session.title}
        evidence={<WorkstreamEvidence session={session} observedAt={data.observedAt} />}
        updates={<TaskUpdates activity={session.activity} />}
        changes={history}
        process={<LiveWorkflow initial={data} workstreamId={workstreamId} />}
      />
    </div>
  )
}
