# Task activity and continuation readiness

Execution registration associates an existing workstream turn with an opaque host session reference. It is not another task list, and it has no independently editable completion flag. Acceptance, current evidence, permission, required reviews and deferred obligations still determine completion.

## Shared tools

| CLI operation / MCP tool | Effect |
| --- | --- |
| `register_execution` | Associate a permitted open turn and optional workflow attempt with a host session reference |
| `record_activity` | Submit a bounded transient observation; no durable per-event operation receipt |
| `get_execution` | Read activity, policy and remaining-work guidance without effects |
| `configure_execution` | Preserve a requested continuation or timeout policy with its provenance |
| `stop_execution` | Record an explicit stop that later activity cannot clear |

The portable CLI form is `spec-ledger operation <name> --file input.json --root /checkout`. Registrations, configuration and stops use normal immutable operation receipts and observed revision/source digests. A registration supplies `workstreamId`, `turnId`, optional `workflowAttemptId`, and a bounded `hostSessionRef`; the tool allocates the registration ID. A caller cannot select another checkout or authenticate a host capability by naming it.

## Best-effort hook delivery

Start `spec-ledger-activity --root /checkout` once and keep its stdin open. It accepts one JSON object per line in the same shape as `record_activity`. A long-lived host integration can reuse its pipe with bounded buffering instead of launching a new process for each event. Do not wait for remote delivery or collector processing in a tool hook.

The exported `createActivityEmitter({ root })` helper owns one collector process. Call `emit(registrationId, event)` from a hook and `close()` when the integration ends. `true` means queued locally, not acknowledged by the collector; `false` means the observation was not queued. Buffering is bounded, and collector errors cannot crash the host. Concurrent direct submissions can be rejected with `accepted: false`; a bounded loss marker keeps the activity projection uncertain even if no later sequence gap arrives. This is best-effort telemetry, not a delivery guarantee.

An event carries `eventId`, `sessionId`, a monotonic `sequence`, `kind` and `observedAt`. Tool events also carry a stable `invocationId` and may name the tool. Supported kinds are `session-start`, `session-stop`, `tool-start`, `tool-finish`, `tool-failure`, `waiting-user`, and `resumed`. Tool arguments, output, credentials and private reasoning are not part of the event schema.

The collector bounds line framing and recovers after oversized or malformed input. Runtime storage is bounded. Duplicate, conflicting, delayed or missing signals cannot create passing evidence or authorize process control. Keep event IDs and sequence numbers stable across delivery retries. After lost history, a sender cannot prove an invocation ended merely by waiting longer.

An in-flight tool may be running, crashed or missing its finish event. Show that ambiguity. A reported waiting state suspends continuation; an explicit stop is sticky. Quiet time and a `session-stop` report do not establish that a host is actually idle or that the work is complete.

## Policy and capability

Continuation and timeout enforcement default off. Configuration can express a requested minimum interval, retry limit and expiry, plus separate warning and enforced-duration thresholds. Portable configuration records agent-reported provenance. It cannot turn that attribution into verified user opt-in, verified host liveness or a cancellation capability.

This release has no host resume or cancellation adapter. The UI therefore shows those controls as unavailable, even if a policy requests them. The evaluator returns the registered task, preserved spec reference, current missing outcomes and a continuation prompt for an agent or user to act on. It does not send that prompt, start an agent, infer a PID from a hook, or terminate a process.

A future adapter must establish ownership and liveness at dispatch time, check explicit opt-in and current permission, respect waits/stops/expiry/retry limits, and deduplicate uncertain dispatches. Tool cancellation additionally needs an owned handle or supported host cancellation API, separate authorization and confirmation of termination before any nudge. Uncertain remote effects require reconciliation. Those are prerequisites for adding an adapter, not capabilities this collector claims to provide.

## What the website means

Activity is shown alongside method progress and evidence, with the registered turn/session, last observation, reported in-flight calls, signal uncertainty and continuation reasons. CLI and MCP updates appear on the normal polling cycle. A disconnected page keeps its last observation and labels it accordingly.

A duration warning means a reported tool has exceeded the configured threshold; it does not prove the tool is hung. A completion percentage counts current acceptance evidence; it does not come from activity events or elapsed time.

Durable registration, requested policy and stop records belong in `.spec-ledger/executions/`. Transient observations belong in ignored `.spec-ledger/runtime/activity/`. Reading either plane does not run checks, persist observations or resume work. Neither activity changes nor loss of runtime history invalidate source evidence or turn missing evidence into a pass.
