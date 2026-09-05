# Shared CLI and MCP operations

W-008 implementation contract. Transport wiring and acceptance evidence are recorded with that workstream; the customizable workflow and activity portions follow in its later slices.

## Ownership

`@nessalabs/spec-ledger` owns application operations, validation, permission, gates, persistence and retry semantics. The existing `spec-ledger` CLI and the local `spec-ledger-mcp` stdio executable are adapters over those operations. MCP never shells out to the CLI. A tool name does not select different business logic from its CLI equivalent.

The UI reads through `@nessalabs/spec-ledger-client`. The generic HTTP projection remains GET-only. A read does not execute checks, prepare a plan snapshot, resume an agent, or write results. Agent-reported implementation and activity remain separate from current verified evidence.

## Work loop

The shared surface provides passive planning, context and session reads; explicit work beginning; progress, decision, evidence and review recording; alignment approval; check execution; turn finish; and workstream completion. Existing CLI aliases remain supported and use the shared operations. The JSON operation surface exposes the same typed input as MCP, while CLI text formatting and exit codes remain transport concerns.

| Shared operation | Intent |
| --- | --- |
| `plan_work`, `get_context`, `get_session` | Inspect plan, context and current evidence without effects |
| `record_permission` | Record existing portable authority semantics without upgrading provenance |
| `begin_work` | Prepare permitted work and open a turn |
| `record_progress`, `record_decision` | Record meaningful implementation reports and choices |
| `record_evidence`, `record_review`, `approve_alignment` | Submit evidence and reviews through their existing contracts |
| `run_checks` | Execute configured checks explicitly |
| `finish_turn`, `complete_work` | Evaluate separate turn and workstream completion gates |

The MCP tool names are these operation names. The portable JSON CLI spelling is `spec-ledger operation <name> --file input.json --root /path/to/checkout`. Mutation inputs carry a stable `requestId`; revision/source-sensitive operations also carry the observed digests. Read current state before proposing a new operation. Retry an uncertain request with its original input and identity, not a newly generated ID. An unknown outcome requires reconciliation, not a new request that repeats the effect.

An agent first inspects the plan and its missing prerequisites. Applicable user permission and a current spec review allow an executable snapshot and turn to be prepared. During implementation the agent records meaningful outcomes and decisions, then supplies actual evidence and independent reviews. Closing the turn and completing the workstream remain distinct gates. A completed command, a progress report, or a green claims report alone cannot mark the workstream complete.

Checks are explicitly named executing operations. The legacy CLI `verify` alias executes checks; passive evaluation is available through session/read APIs. Integrations must not interpret that legacy command name as a passive read.

## Retries and concurrent callers

Mutations use a stable request ID shared across CLI and MCP. A started record binds the request ID to the operation and input digest before effects occur; a finished record stores the result afterward. Records live in `.spec-ledger/operations/` and do not become evidence of product correctness.

These receipts are application bookkeeping, excluded from product dirty-path and turn-change accounting. Recording a request must not make its own clean-start check fail. Pre-existing source changes still trigger the normal dirty-work safeguard; excluding receipts does not authorize incorporating those changes.

A completed identical request returns its original result. A different request using the same ID fails. An unfinished request has an unknown outcome and is not automatically rerun, particularly when a check might already have executed external effects. This is honest uncertainty, not a claim of exactly-once execution or a distributed transaction.

Participating mutation callers serialize within the configured checkout. An existing lock whose ownership cannot be established remains busy/unknown. A timeout is not proof that another writer stopped. Arbitrary direct filesystem writers remain outside this cooperation protocol.

## Trust boundary

The host chooses the checkout when starting the local stdio server. Tool inputs cannot switch roots or request arbitrary filesystem/shell operations. Typed arguments, IDs and paths are validated before persistence. Local skill and artifact access remains confined and bounded. Diagnostics go to stderr; stdout belongs to MCP messages.

Exposing a permission operation does not authenticate an agent-supplied user identity. Portable authority keeps its recorded provenance and existing scope constraints. Hosts requiring stronger prevention must enforce permissions outside the writable repository as well.

MCP supplies operations for an agent to call. It does not itself supply a universal host-session liveness, cancellation or resume API. Optional activity and recovery integrations must advertise actual capabilities, with user opt-in; missing signals or unsupported controls never imply successful recovery.
