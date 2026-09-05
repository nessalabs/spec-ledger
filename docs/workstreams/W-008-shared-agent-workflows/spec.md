# Guide agents and follow verified work

## Intent and authority

Implement the agreed customizable engineering workflow proposal through the existing CLI and a new MCP surface. Both call the same application logic. Users can follow ongoing work and inspect verification in the website without reading agent transcripts. This request authorizes implementation and local verification; it does not authorize deployment, automatic host cancellation, or enabling continuation for the user.

The proposal in ../../proposals/customizable-engineering-workflows.md supplies the detailed method and activity contracts. This spec makes the implementation acceptance explicit. Library/local deployment follows the existing vision. Permission, evidence integrity, path confinement and cancellation are trust boundaries; unit, integration, protocol and browser evidence are required.

## Outcomes

1. An agent can obtain context, prepare permitted work, open a turn, report meaningful progress, record evidence/reviews, inspect remaining outcomes and close/complete through CLI or MCP. Equivalent input has equivalent effects and gate outcomes. Existing CLI commands remain supported. MCP uses a fixed startup checkout and stdio; no shell wrapping of the CLI and no generic HTTP write routes.
2. A user can select default engineering steps or substitute local skills and customize ordered stages. Resolved skill text/digests and stage contracts are preserved with the execution revision. Missing skills, invalid orders and unsupported contracts are actionable errors. Custom steps cannot weaken permission or evidence invariants. Stage attempts reference existing records; reported completion and verified satisfaction stay separate.
3. The website presents selected workflow, running/reported steps, blocking items, requirements, current check evidence and reviews together. Updates submitted through either surface appear on subsequent observations. Users can drill into the check, result, time, source/revision and artifacts that support each outcome. Stale/disconnected observations and missing/failed evidence remain visible. No fabricated completion percentage.
4. An agent can associate its host/session with an existing turn and submit bounded best-effort activity signals. Duplicate/out-of-order/dropped events are handled conservatively. Activity does not invalidate source evidence or prove completion. Optional continuation policy and remaining-work guidance are visible; unsupported resume/cancel controls are explicitly unavailable. No host processes are invoked by the core. A host integration must prove ownership/liveness before any opted-in recovery; lack of capability yields guidance, never a claimed recovery.

## Invariants and failure cases

### Concrete method contracts

The v1 output registry is finite: `spec-revision`, `spec-review`, `implementation-report`, `check-results`, `code-review`, and `attestation`. A spec revision requires a preserved current snapshot; spec review requires current revision-bound approval without unresolved blocking findings; implementation requires current source/revision-bound criterion reports; checks require current behavioral passing evidence for mapped criteria; code review requires current source-bound approval under existing review policy. An attestation may satisfy an explicitly attested method step but is always labeled attested and never substitutes for required checks or independent reviews. Unknown output kinds are rejected. Each configured step declares one of these contracts and optional scoped criterion references; empty output contracts cannot produce a satisfied step.

Skill substitution preserves local text and its digest in the resolved method snapshot. Attempts bind to that snapshot and current revision; output references must belong to the workstream and match the contract. Source-sensitive outputs become stale on relevant source changes; spec outputs depend on revision. Method amendments create a new snapshot with a reason and conservatively require new attempts; historical outputs remain visible. Ordered custom stages cannot move an implementation step ahead of a policy-required spec review. The completion gate checks required method outputs as well as existing completion conditions.

### Executable parity proof

In disposable repositories, exercise actual CLI and MCP executables through plan/context read, authorized snapshot preparation and turn opening, progress/decision write, externally recorded evidence, spec/code/align review submission as applicable, explicit checks, turn close and workstream completion. Inspect the same session projection after writes. Paired negative cases cover denied permission, stale revision/source, malformed input, missing evidence and conflicting retry IDs, asserting both equivalent errors and absence of unintended persisted effects. Repeated non-executing mutations return their original receipt; uncertain command execution is reported unknown and not automatically rerun. Transport envelopes, timestamps and allocated identifiers may differ between independent fixtures; semantic outcomes may not.

Shared mutation request receipts live under `.spec-ledger/operations/`, keyed by a validated request ID and immutable input digest. Persist a started receipt before any effect and a completion receipt afterward; a retry with an unfinished receipt reports unknown rather than repeating effects. Completed requests return the original result, conflicting input is rejected. Serialize mutations across participating CLI/MCP processes to prevent ID allocation and result projection races. Unknown lock ownership remains busy/unknown, not a reason to steal the lock. This protocol does not claim atomicity against arbitrary direct filesystem edits.

- Shared application operations own validation, permission, gate evaluation, persistence and retry semantics. Adapters own only transport and presentation.
- Reads never execute checks, install skills, write evidence or resume an agent. Explicit check execution remains a distinct operation.
- No adapter authenticates a user based on an agent-supplied string. Denial, stale revision, missing evidence and blocking reviews have identical meaning across surfaces.
- Stage satisfaction derives from typed required outputs and current dependencies. A skill name or stage report is not proof of review quality or passing code.
- Local skills and artifacts are confined and bounded; remote instruction fetching is not implicit. MCP input cannot select another repository.
- Activity storage is bounded, ignored local runtime state. Durable workflow configuration, snapshots and consequential decisions are recorded in the ledger. Retries cannot overwrite immutable receipts.
- Continuation and tool cancellation default off. Explicit stop, revoked permission, expiry and retry exhaustion prevent dispatch. Quiet hooks alone never establish idleness or justify killing a process.

## Delivery and evidence

### Security model

The assets are the configured checkout, preserved spec/permission records, evidence integrity and the user's running processes. The host starts the local MCP process with filesystem privileges; MCP clients and hook senders supply untrusted fields. Spec Ledger is not a sandbox against a process already able to rewrite its files. Its application operations enforce permission and evidence semantics for cooperative integrations; the transport must not add arbitrary shell or filesystem access.

Test malformed IDs and path traversal through real tool calls and verify no files outside the fixture checkout change. Test denied/stale mutations and inspect persisted state, not only the error. Exercise skill symlinks and oversized inputs with a valid local-skill control. Activity senders cannot mint authority, passing evidence or a cancellation capability: forged invocation/session identifiers and dropped finish events must leave recovery blocked/unknown without dispatch or process signals. All destructive test fixtures are locally owned disposable processes, if a cancellation adapter is implemented.

Deliver in three executable verticals: (1) perform and observe a full work loop through interchangeable CLI/MCP surfaces, (2) select and follow a custom method with current evidence in the UI, (3) associate execution activity and expose honest optional recovery readiness. Each vertical includes its UI/projection where applicable, adversarial review and behavioral tests. Integration evidence must exercise the actual MCP executable and CLI, not only call a shared helper. Browser evidence must exercise updates and negative states, not only a static successful page.

Keep existing package directions: UI imports client only; application code lives in ledger; MCP composes on it. Start without a DAG runtime. External hosted execution, automatic model choice, remote skill marketplaces and task-tracker synchronization are not part of this change. No promise of host resume or cancellation without a concrete supported adapter and verification.
