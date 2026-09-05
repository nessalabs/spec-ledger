import Link from "next/link"
import { Badge } from "@nessalabs/ui"
import type { SessionProjection } from "@nessalabs/spec-ledger-client"
import {
  durationLabel,
  executionReasonLabel,
  executionStateLabel,
} from "@/lib/execution-presentation"

type Session = NonNullable<SessionProjection["session"]>
type Execution = Session["executionActivity"]

function StateBadge({ state }: { state: Execution["state"] }) {
  return (
    <Badge variant={state === "uncertain" || state === "stopped" ? "destructive" : "outline"}>
      {executionStateLabel(state)}
    </Badge>
  )
}

function Capability({ label, available }: { label: string; available: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 border-t border-border/60 py-2 first:border-0">
      <span>{label}</span>
      <Badge variant="outline">{available ? "Available" : "Unavailable"}</Badge>
    </li>
  )
}

export function ExecutionActivitySummary({
  execution,
  workstreamId,
}: {
  execution: Execution
  workstreamId: string
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border p-4" aria-label="Agent execution activity">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Agent execution</h2>
          <p className="text-xs text-muted-foreground">
            Best-effort host signals · never verification evidence
          </p>
        </div>
        <StateBadge state={execution.state} />
      </div>
      {execution.association ? (
        <p className="text-sm">
          <Link className="underline" href={`/turns/${encodeURIComponent(execution.association.turnId)}`}>
            {execution.association.turnId}
          </Link>
          {execution.inflightInvocations.length
            ? ` · ${execution.inflightInvocations.length} invocation${execution.inflightInvocations.length === 1 ? "" : "s"} unresolved`
            : " · no unresolved invocation reported"}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No host session is associated with this workstream.</p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{execution.signals.retained} signals retained</span>
        <span>{execution.signals.dropped} evicted</span>
        <span>{execution.signals.gaps.length} sequence gap{execution.signals.gaps.length === 1 ? "" : "s"}</span>
        <span>Continuation {execution.continuation.requested ? "requested" : "off"}</span>
      </div>
      {execution.waiting.active ? (
        <p className="text-sm">Waiting for user{execution.waiting.reason ? ` · ${execution.waiting.reason}` : ""}</p>
      ) : null}
      {execution.timeout.warnings.length ? (
        <p className="text-sm text-amber-600">{execution.timeout.warnings.length} tool duration warning{execution.timeout.warnings.length === 1 ? "" : "s"}</p>
      ) : null}
      <Link className="text-sm underline" href={`/workstreams/${encodeURIComponent(workstreamId)}#execution-activity`}>
        Inspect execution signals and continuation limits
      </Link>
    </section>
  )
}

export function ExecutionActivityDetails({ execution }: { execution: Execution }) {
  return (
    <section id="execution-activity" className="scroll-mt-6 space-y-5" aria-label="Agent execution activity">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">Agent execution</h2>
          <StateBadge state={execution.state} />
        </div>
        <p className="text-sm text-muted-foreground">
          These are bounded, best-effort host signals. Missing events mean activity is unknown; they do not prove completion or rerun work.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <h3 className="font-medium">Session association</h3>
        {execution.association ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>{execution.association.registrationId} · {execution.association.provenance}</p>
            <p>Host session {execution.association.hostSessionRef}</p>
            <p>Turn <Link className="underline" href={`/turns/${encodeURIComponent(execution.association.turnId)}`}>{execution.association.turnId}</Link></p>
            <p>Workflow attempt {execution.association.workflowAttemptId ?? "not linked"}</p>
            <p>Registered {execution.association.registeredAt}</p>
            <p className="break-all">Revision {execution.association.revisionDigest}</p>
            <p className="break-all">Source {execution.association.sourceDigest}</p>
          </div>
        ) : <p className="text-sm text-muted-foreground">No host session is registered.</p>}
        {execution.stop.stopped ? (
          <p className="text-sm">Stopped{execution.stop.stoppedAt ? ` ${execution.stop.stoppedAt}` : ""}{execution.stop.reason ? ` · ${execution.stop.reason}` : ""}</p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-medium">Current host observation</h3>
          <p className="text-xs text-muted-foreground">Last seen {execution.signals.lastObservedAt ?? "unknown"}</p>
        </div>
        {execution.waiting.active ? (
          <p className="text-sm">Waiting for user{execution.waiting.since ? ` since ${execution.waiting.since}` : ""}{execution.waiting.reason ? ` · ${execution.waiting.reason}` : ""}</p>
        ) : null}
        {execution.inflightInvocations.length ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Unresolved tool invocations</p>
            {execution.inflightInvocations.map((invocation) => (
              <div key={invocation.invocationId} className="rounded-lg border border-border/60 p-3 text-xs">
                <p>{invocation.toolName ?? "Unnamed tool"} · {invocation.status === "finish-missing" ? "finish signal missing" : "reported in flight"}</p>
                <p className="text-muted-foreground">{invocation.invocationId} · started {invocation.startedAt} · sequence {invocation.lastSequence}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">No unresolved tool invocation is reported.</p>}
      </section>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <h3 className="font-medium">Signal quality</h3>
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p>{execution.signals.retained} retained</p>
          <p>{execution.signals.totalSeen} unique accepted</p>
          <p>{execution.signals.dropped} evicted from history</p>
          <p>{execution.signals.duplicateCount} duplicates · {execution.signals.outOfOrderCount} out of order</p>
        </div>
        {execution.signals.gaps.length ? (
          <p className="text-sm text-destructive">Missing sequences: {execution.signals.gaps.map((gap) => `${gap.from}–${gap.to}`).join(", ")}</p>
        ) : null}
        <details className="rounded-lg border border-border/60 p-3 text-xs">
          <summary className="cursor-pointer">Recent bounded events, newest first ({execution.signals.recentEvents.length})</summary>
          {execution.signals.recentEvents.length ? (
            <ul className="mt-3 space-y-2 text-muted-foreground">
              {execution.signals.recentEvents.map((event) => (
                <li key={event.eventId} className="rounded border border-border/60 p-2">
                  <p>{event.kind} · sequence {event.sequence} · {event.observedAt}</p>
                  <p>{event.eventId} · session {event.sessionId}</p>
                  {event.invocationId ? <p>Invocation {event.invocationId}{event.toolName ? ` · ${event.toolName}` : ""}</p> : null}
                  {event.reason ? <p>{event.reason}</p> : null}
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-muted-foreground">No activity events retained.</p>}
        </details>
      </section>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">Continuation</h3>
          <Badge variant="outline">{execution.continuation.requested ? execution.continuation.readiness : "Off by default"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Effective continuation: {execution.continuation.effective ? "enabled" : "disabled"} · verified user opt-in: {execution.continuation.userOptInVerified ? "yes" : "no"}
        </p>
        <p className="text-xs text-muted-foreground">
          Minimum interval {durationLabel(execution.continuation.minIntervalMs)} · {execution.continuation.remainingRetries}/{execution.continuation.retryLimit} retries remain · expires {execution.continuation.expiresAt ?? "never"}
        </p>
        {execution.continuation.reasons.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {execution.continuation.reasons.map((reason) => <li key={reason}>{executionReasonLabel(reason)}</li>)}
          </ul>
        ) : null}
        {execution.continuation.guidance.length ? (
          <div className="space-y-1 text-sm">
            <p className="font-medium">Remaining-work guidance</p>
            <ul className="list-disc space-y-1 pl-5">
              {execution.continuation.guidance.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ) : null}
        {execution.continuation.prompt ? (
          <details className="rounded-lg border border-border p-3 text-sm">
            <summary className="cursor-pointer">Continuation prompt · not sent</summary>
            <pre className="mt-3 whitespace-pre-wrap break-words text-xs">{execution.continuation.prompt}</pre>
          </details>
        ) : null}
        <p className="text-xs text-muted-foreground">Dispatch attempts: {execution.continuation.attempts.length}</p>
      </section>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">Tool duration policy</h3>
          <Badge variant="outline">Enforcement {execution.timeout.enforcement}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Warning {execution.timeout.warningAfterMs === null ? "off" : `after ${durationLabel(execution.timeout.warningAfterMs)}`} · enforced timeout {execution.timeout.enforceAfterMs === null ? "off" : `after ${durationLabel(execution.timeout.enforceAfterMs)}`}
        </p>
        {execution.timeout.warnings.map((warning) => (
          <p key={`${warning.invocationId}/${warning.thresholdMs}`} className="text-sm text-amber-600">
            {warning.invocationId} has run {durationLabel(warning.elapsedMs)} · warning threshold {durationLabel(warning.thresholdMs)}
          </p>
        ))}
        {execution.timeout.reasons.map((reason) => <p key={reason} className="text-sm">{reason}</p>)}
      </section>

      <section className="space-y-2 rounded-xl border border-border p-4">
        <h3 className="font-medium">Host controls</h3>
        <p className="text-xs text-muted-foreground">Capabilities are unavailable unless the host verifies them. This page does not resume or cancel an agent.</p>
        <ul className="text-sm">
          <Capability label="Verified host identity" available={execution.hostCapabilities.verified} />
          <Capability label="Liveness check" available={execution.hostCapabilities.liveness} />
          <Capability label="Resume session" available={execution.hostCapabilities.resume} />
          <Capability label="Cancel one tool" available={execution.hostCapabilities.cancelTool} />
          <Capability label="Owned process handle" available={execution.hostCapabilities.ownedProcess} />
        </ul>
      </section>

      <details className="rounded-xl border border-border p-4 text-sm">
        <summary className="cursor-pointer font-medium">Observe or update execution activity</summary>
        <div className="mt-3 space-y-3 text-muted-foreground">
          <p>
            This page is read-only and updates from the same session projection. Use the CLI or the
            matching MCP operation to record host-reported changes.
          </p>
          <p>
            Observe with <code>spec-ledger operation get_execution --file input.json --root /absolute/checkout</code>
            {" "}or MCP <code>get_execution</code>.
          </p>
          <p>
            Write operations are <code>register_execution</code>, <code>configure_execution</code>,
            {" "}<code>record_activity</code>, and <code>stop_execution</code>. The CLI form is
            {" "}<code>spec-ledger operation &lt;name&gt; --file input.json --root /absolute/checkout</code>;
            MCP uses the same operation name.
          </p>
          <p>Continuation readiness is observational. Neither this page nor a readiness read dispatches an agent.</p>
        </div>
      </details>
    </section>
  )
}
