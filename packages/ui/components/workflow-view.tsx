import Link from "next/link"
import { AlertTriangle, ChevronDown, MinusCircle } from "lucide-react"
import { Badge, TaskList, TaskListItem } from "@nessalabs/ui"
import type { SessionProjection } from "@nessalabs/spec-ledger-client"
import { digestLabel, workflowOutputLabel, workflowStatusView } from "@/lib/workflow-presentation"

type Session = NonNullable<SessionProjection["session"]>
type Workflow = Session["workflow"]
type Stage = Workflow["stages"][number]
type Output = Stage["requiredOutputs"][number]
type OutputRef = Output["refs"][number]

function StatusBadge({ status }: { status: Stage["status"] | Workflow["status"] }) {
  const view = workflowStatusView(status)
  return (
    <Badge variant={status === "blocked" ? "destructive" : "outline"}>
      {view.label}
    </Badge>
  )
}

function StageIndicator({ status }: { status: Stage["status"] }) {
  if (status === "blocked") return <AlertTriangle className="size-[18px] text-destructive" />
  if (status === "not-applicable") return <MinusCircle className="size-[18px] text-muted-foreground" />
  return null
}

function StageTask({ stage, waiting = false }: { stage: Stage; waiting?: boolean }) {
  const view = workflowStatusView(stage.status)
  const indicator = waiting ? null : <StageIndicator status={stage.status} />
  return (
    <TaskListItem
      status={waiting ? "todo" : view.taskStatus ?? undefined}
      icon={view.taskStatus ? undefined : indicator}
      meta={waiting ? <Badge variant="outline">Waiting for previous step</Badge> : <StatusBadge status={stage.status} />}
    >
      {stage.title}
    </TaskListItem>
  )
}

function OutputReference({ reference, criterionIds }: { reference: OutputRef; criterionIds: Set<string> }) {
  return (
    <li className="space-y-1 rounded-md border border-border/60 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono">{reference.id}</span>
        <Badge variant="outline">{reference.recordType}</Badge>
        <Badge variant={reference.current ? "outline" : "destructive"}>
          {reference.current ? "Current" : "Outdated"}
        </Badge>
        {reference.attested ? <Badge variant="outline">Attested</Badge> : null}
      </div>
      <p>Attempt {reference.attemptId} · recorded {reference.recordedAt}</p>
      <p className="break-all">Method {reference.snapshotDigest}</p>
      <p className="break-all">Revision {reference.revisionDigest}</p>
      <p className="break-all">Source {reference.sourceDigest}</p>
      {reference.recordIds.length ? <p>Records: {reference.recordIds.join(", ")}</p> : null}
      {reference.criterionIds.length ? (
        <p>
          Criteria:{" "}
          {reference.criterionIds.map((id, index) => (
            <span key={id}>
              {index ? ", " : ""}
              {criterionIds.has(id) ? <a className="underline" href={`#acceptance-${encodeURIComponent(id)}`}>{id}</a> : id}
            </span>
          ))}
        </p>
      ) : null}
      {reference.reason ? <p>{reference.reason}</p> : null}
    </li>
  )
}

function RequiredOutput({ output, criterionIds }: { output: Output; criterionIds: Set<string> }) {
  return (
    <details className="rounded-lg border border-border/60 p-3">
      <summary className="cursor-pointer text-sm">
        <span className="mr-2 font-medium">{workflowOutputLabel(output.kind)}</span>
        <Badge variant={output.satisfied && output.current ? "outline" : "destructive"}>
          {output.satisfied ? (output.current ? "Satisfied" : "Outdated") : "Missing"}
        </Badge>
      </summary>
      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
        <p>Contract <code>{output.kind}</code></p>
        <p>Step {output.stepTitle} · <code>{output.stepId}</code></p>
        {output.criterionIds.length ? <p>Criteria: {output.criterionIds.join(", ")}</p> : null}
        {output.reason ? <p>{output.reason}</p> : null}
        {output.refs.length ? (
          <ul className="space-y-2">
            {output.refs.map((reference) => <OutputReference key={reference.id} reference={reference} criterionIds={criterionIds} />)}
          </ul>
        ) : (
          <p>No typed output has been recorded for this contract.</p>
        )}
      </div>
    </details>
  )
}

function WorkflowStage({ stage, current, criterionIds }: { stage: Stage; current: boolean; criterionIds: Set<string> }) {
  return (
    <details
      className="group rounded-xl border border-border p-4"
      open={current}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">{stage.title}</p>
            <p className="text-xs text-muted-foreground">{stage.role} · {stage.id}</p>
          </div>
          <span className="flex items-center gap-2">
            <StatusBadge status={stage.status} />
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </span>
        </div>
      </summary>
      <div className="mt-4 space-y-5 border-t border-border pt-4">
        {stage.blockers.length ? (
          <div className="space-y-1 text-sm text-destructive">
            <p className="font-medium">Blocking this stage</p>
            <ul className="list-disc space-y-1 pl-5">
              {stage.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
            </ul>
          </div>
        ) : null}

        <section className="space-y-2">
          <h4 className="text-sm font-medium">Required outputs</h4>
          {stage.requiredOutputs.map((output) => (
            <RequiredOutput key={`${stage.id}/${output.stepId}/${output.kind}/${output.criterionIds.join(",")}`} output={output} criterionIds={criterionIds} />
          ))}
        </section>

        <section className="space-y-3">
          <h4 className="text-sm font-medium">Steps and selected skills</h4>
          {stage.steps.map((step) => (
            <details key={step.id} className="rounded-lg bg-muted/30 p-3">
              <summary className="cursor-pointer text-sm">
                <span className="mr-2 font-medium">{step.title}</span>
                <StatusBadge status={step.status} />
              </summary>
              <div className="mt-3 space-y-3 text-xs text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground">{step.skill.id}</p>
                  <p>{step.skill.source} skill · capability {step.skill.capability}</p>
                  <p>Declared outputs: {step.skill.capabilities.length ? step.skill.capabilities.join(", ") : "none"}</p>
                  {step.skill.capability === "uncertain" ? (
                    <p>{step.skill.uncertaintyAcknowledged ? "Capability uncertainty acknowledged" : "Capability uncertainty needs acknowledgement"}</p>
                  ) : null}
                  {step.skill.path ? <p className="break-all">{step.skill.path}</p> : null}
                  <p className="break-all">Skill digest {step.skill.digest}</p>
                </div>
                <details className="rounded-md border border-border/60 p-2">
                  <summary className="cursor-pointer">Read preserved skill instructions</summary>
                  <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words text-foreground">{step.skill.content}</pre>
                </details>
                <div className="space-y-2">
                  <p className="font-medium text-foreground">Attempts</p>
                  {step.attempts.length ? step.attempts.map((attempt) => (
                    <details key={attempt.id} className="rounded-md border border-border/60 p-2">
                      <summary className="cursor-pointer">
                        {attempt.id} · {attempt.reportedStatus}
                      </summary>
                      <div className="mt-2 space-y-1">
                        <p>Started {attempt.startedAt}</p>
                        <p className="break-all">Method {attempt.snapshotDigest}</p>
                        <p className="break-all">Revision {attempt.revisionDigest}</p>
                        <p className="break-all">Source {attempt.sourceDigest}</p>
                        {attempt.reason ? <p>{attempt.reason}</p> : null}
                        {attempt.outputRefs.length ? (
                          <ul className="mt-2 space-y-2">
                            {attempt.outputRefs.map((reference) => (
                              <OutputReference key={reference.id} reference={reference} criterionIds={criterionIds} />
                            ))}
                          </ul>
                        ) : <p>No outputs recorded for this attempt.</p>}
                      </div>
                    </details>
                  )) : <p>No attempts recorded.</p>}
                </div>
              </div>
            </details>
          ))}
        </section>
      </div>
    </details>
  )
}

export function WorkflowSummary({ workflow, workstreamId }: { workflow: Workflow; workstreamId: string }) {
  return (
    <section className="space-y-3 rounded-xl border border-border p-4" aria-label="Engineering method">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Workflow steps</h2>
          <p className="text-sm">{workflow.profile.title}</p>
          <p className="text-xs text-muted-foreground">
            {workflow.profile.source === "default" ? "Default" : "Custom"} · method {digestLabel(workflow.profile.snapshotDigest)}
          </p>
        </div>
        <StatusBadge status={workflow.status} />
      </div>
      <TaskList aria-label="Workflow stages" className="rounded-lg bg-muted/20 p-3">
        {workflow.stages.map((stage, index) => <StageTask key={stage.id} stage={stage} waiting={stage.status === "blocked" && workflow.stages.slice(0, index).some(prior => !["satisfied", "not-applicable"].includes(prior.status)) && !stage.steps.some(step => step.attempts.some(attempt => attempt.reportedStatus === "blocked"))} />)}
      </TaskList>
      {workflow.blockers.length ? (
        <p className="text-sm text-destructive">{workflow.blockers.length} method blocker{workflow.blockers.length === 1 ? "" : "s"}</p>
      ) : null}
      <Link className="text-sm underline" href={`/workflows/${encodeURIComponent(workstreamId)}`}>
        Open workflow
      </Link>
    </section>
  )
}

export function WorkflowDetails({ workflow, criteria }: { workflow: Workflow; criteria: Array<{ id: string }> }) {
  const criterionIds = new Set(criteria.map((criterion) => criterion.id))
  return (
    <section id="engineering-method" className="scroll-mt-6 space-y-5" aria-label="Engineering method and evidence">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">Workflow steps</h2>
          <Badge variant="outline">{workflow.profile.source === "default" ? "Default" : "Custom"}</Badge>
          <StatusBadge status={workflow.status} />
        </div>
        <p className="text-sm">{workflow.profile.title}</p>
        <p className="text-xs text-muted-foreground">
          {workflow.profile.snapshotId ? "Your selected workflow." : "Standard workflow · progress inferred from records, not tracked agent activity."}
        </p>
        <details className="rounded-lg border border-border/60 p-3 text-xs">
          <summary className="cursor-pointer font-medium">Technical details and history</summary>
          <div className="mt-3 space-y-3 text-muted-foreground">
            <p>Profile {workflow.profile.id}</p>
            <p className="break-all">Method digest {workflow.profile.snapshotDigest}</p>
            <p className="break-all">Revision {workflow.profile.revisionDigest}</p>
            {workflow.profile.snapshotId ? <p>Snapshot {workflow.profile.snapshotId}</p> : <p>Default method · not explicitly preserved yet.</p>}
            {workflow.profile.reason ? <p>Selection reason: {workflow.profile.reason}</p> : null}
            <div className="space-y-1">
              <p className="font-medium text-foreground">Preview</p>
              <code className="block overflow-x-auto rounded bg-muted p-2">spec-ledger operation preview_workflow --file workflow.json --root /checkout</code>
              <p>MCP tool: <code>preview_workflow</code></p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">Select</p>
              <code className="block overflow-x-auto rounded bg-muted p-2">spec-ledger operation set_workflow --file workflow.json --root /checkout</code>
              <p>MCP tool: <code>set_workflow</code></p>
            </div>
            {workflow.historicalSnapshots.length ? (
              <details>
                <summary className="cursor-pointer">Earlier method snapshots</summary>
                <ul className="mt-2 space-y-2">
                  {workflow.historicalSnapshots.map((snapshot) => (
                    <li key={`${snapshot.snapshotId ?? "default"}/${snapshot.digest}`} className="rounded border border-border/60 p-2">
                      <p>{snapshot.snapshotId ?? "Default method"} · {snapshot.createdAt}</p>
                      <p className="break-all">{snapshot.digest}</p>
                      <p className="break-all">Revision {snapshot.revisionDigest}</p>
                      {snapshot.reason ? <p>{snapshot.reason}</p> : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </details>
      </div>

      {workflow.blockers.length ? (
        <div className="space-y-1 rounded-lg border border-destructive/40 p-3 text-sm">
          <p className="font-medium">Method blockers</p>
          <ul className="list-disc space-y-1 pl-5 text-destructive">
            {workflow.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="space-y-3">
        {workflow.stages.map((stage) => (
          <WorkflowStage key={stage.id} stage={stage} current={stage.id === workflow.currentStageId} criterionIds={criterionIds} />
        ))}
      </div>
    </section>
  )
}
