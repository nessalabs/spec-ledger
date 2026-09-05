"use client"

import type { SessionProjection } from "@nessalabs/spec-ledger-client"
import { AcceptanceProgress } from "@/components/acceptance-progress"
import { WorkstreamEvidence } from "@/components/workstream-evidence"
import { useSessionObservation } from "@/components/use-session-observation"

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
      />
      <WorkstreamEvidence session={session} observedAt={data.observedAt} />
    </div>
  )
}
