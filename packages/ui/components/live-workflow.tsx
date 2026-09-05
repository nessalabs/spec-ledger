"use client"
import type { SessionProjection } from "@nessalabs/spec-ledger-client"
import { useSessionObservation } from "@/components/use-session-observation"
import { WorkflowEditor } from "@/components/workflow-editor"
import { WorkflowDetails } from "@/components/workflow-view"
import { ExecutionActivityDetails } from "@/components/execution-activity"
export function LiveWorkflow({ initial, workstreamId }: { initial: SessionProjection; workstreamId: string }) {
  const { data, state } = useSessionObservation(initial, workstreamId)
  const session = data.session?.workstreamId === workstreamId ? data.session : initial.session
  if (!session) return null
  return <div className="space-y-6"><p role="status" className="text-xs text-muted-foreground">{state === "disconnected" ? "Disconnected · showing the last observation" : "Following workflow updates"}</p><WorkflowEditor key={workstreamId} workstreamId={workstreamId} />{session.status === "done" && <details className="text-xs text-muted-foreground"><summary>About earlier completion</summary><p>These are the current process requirements, not a replay of how this work was originally completed.</p></details>}<WorkflowDetails workflow={session.workflow} criteria={session.criteria} />{session.executionActivity.association ? <ExecutionActivityDetails execution={session.executionActivity} /> : <details className="text-xs text-muted-foreground"><summary>Agent connection</summary><p>No agent session is registered. Spec Ledger cannot tell whether an agent is running or resume it.</p></details>}</div>
}
