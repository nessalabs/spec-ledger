"use client"

import type { SessionProjection } from "@nessalabs/spec-ledger-client"
import { AcceptanceProgress } from "@/components/acceptance-progress"
import { WorkstreamEvidence } from "@/components/workstream-evidence"
import { useSessionObservation } from "@/components/use-session-observation"
import { WorkflowDetails } from "@/components/workflow-view"
import { ExecutionActivityDetails } from "@/components/execution-activity"

export function LiveWorkstreamEvidence({
  initial,
  workstreamId,
}: {
  initial: SessionProjection
  workstreamId: string
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
      <WorkstreamEvidence session={session} observedAt={data.observedAt} />
      {session.status === "done" ? <details><summary>Current method requirements · not the original execution history</summary><WorkflowDetails workflow={session.workflow} criteria={session.criteria} /></details> : <WorkflowDetails workflow={session.workflow} criteria={session.criteria} />}
      {session.executionActivity.association ? <ExecutionActivityDetails execution={session.executionActivity} /> : <details><summary>Agent activity · no session registered</summary><ExecutionActivityDetails execution={session.executionActivity} /></details>}
    </div>
  )
}
