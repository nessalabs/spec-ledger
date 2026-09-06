# Follow agent experiments

People should be able to see what an agent is trying to improve, what it tried, and what it learned, including from a screenshot sent by a headless agent. User delegated shaping and building this feature in the current request. Scope is a local/library feature with no deployment, execution scheduler, or new credentials.

## Model and boundaries

Add an optimization history module in ledger, separate from claims/evidence verification. A goal belongs to an existing workstream and originating turn; creating one marks that task as iterative work without changing turn facts. A goal has an objective, stopping rule, optional experiment budget, and an optional immutable metric (name, unit, minimize/maximize, evaluation protocol, baseline, target). Qualitative goals can record experiments without inventing a numeric score. A different metric or evaluation protocol requires a new goal.

An experiment is an immutable attempt with hypothesis, change description, turn association, and optional parent experiment (same goal, already finished). A separate immutable result records completed/failed, optional finite measurement, kept/discarded/inconclusive decision, findings, and optional evidence references. Failed results have no measurement and use the inconclusive decision; they never contribute to numeric aggregates. A result never implies verify pass. Retries with identical IDs/payloads are idempotent; conflicting reuse is rejected. Experiments and results must refer to existing matching parents. Every mutation names a currently open turn in the same workstream and checks current permission and revision. The originating turn may close; later authorized turns can continue the same goal, but stale or closed turns cannot write new history. A goal can be explicitly concluded with a summary; budget exhaustion blocks new attempts, and goal conclusion refuses unfinished attempts. Target attainment is a measured observation, never a permission/completion gate. No automatic agent execution or claim completion.

All mutations use shared application operations exposed in CLI/MCP; Git remains persistence. Read-only client/server expose list/detail projections. Validate IDs, numeric inputs, references, and storage containment; publish each record atomically and serialize dependent mutations. Reads must not create files or run checks.

## Inspect experience

Add an Experiments navigation destination and a goal detail view, linked from associated workstream/turn screens. Show objective, state, stopping rule, budget, metric and protocol, baseline/latest/best measurements, whether the best was retained, and last recorded update. Use a line chart of measured attempts with baseline/target context and an experiment results table that includes failed, pending, discarded and inconclusive attempts. Gaps never become zero; lower-is-better and higher-is-better are explicit; no fabricated progress percentage. Qualitative/empty/single-point cases remain useful. Show findings and evidence references as text (do not fetch arbitrary URLs). Include a refresh action and capture time so screenshots communicate snapshot freshness.

Reuse Nessa UI Badge/Card/Table primitives as appropriate. Existing chart offerings are inspected; if no general metric line chart fits, add a small accessible SVG chart locally without another dependency. Build a clearly labeled demonstration fixture outside the real ledger for visual verification and screenshot capture.

## Acceptance

1. An agent can create a goal on an open task, start and finish attempts, retry safely, and conclude with findings through CLI and shared operations; invalid references, conflicting retries, nonfinite numbers, budget overflow and late writes fail without partial history.
2. A person can inspect the same goal and its honest numeric or qualitative history through client/GET server/UI, with a screenshot-readable chart and results table, including pending and failed attempts.
3. Existing verify semantics, permission/completion gates and server read-only boundary remain unchanged; documentation explains headless usage and measured versus verified evidence.

## Out of scope

Scheduling or running experiments, executing evidence URLs, automatic git changes/retention, statistical significance claims, cross-repository goals, multiple incomparable metrics on one chart, changing authority or workstream completion rules, publishing or pushing.

## Evidence

Unit and integration tests exercise storage and application/CLI paths, duplicate and invalid writes, projections, and GET transport. UI typecheck/build and browser inspection cover numeric and qualitative/empty displays. Independent spec and code breakers are required. Existing repository build/test/verify/audit/align checks run before close.

## Evidence presentation follow-up (user requested)

The user confirmed the layout and explicitly requested implementation: one expandable requirement card, green passing status with text, test descriptions and actual captured output first, source/command collapsed below, and a compact Run again action. Include the existing labeled UI demo screenshot as previewable evidence. Keep failed/missing/attested and historical evidence honest. No invented individual test outcomes: display recorded test-run output, preserving skip/fail/unknown statuses.

Use existing UI/client boundaries and attachment metadata. Allow bounded, digest-checked local PNG/JPEG previews through the existing session projection; deny remote URLs, escaping paths, unsupported/invalid image types and changed bytes. Screenshot previews are supporting observations, never verifier pass. Attach the existing demo to the new follow-up turn, with honest historical capture labeling. No writes to closed turn facts. Workstream-level visual evidence should be prominent beside requirements; no invented requirement association. Preserve passive reads, guarded run retries, reconnect behavior and output integrity. Browser checks cover keyboard expansion, result-first layout, screenshot enlargement, narrow screens, failures and missing output.

This is one follow-up vertical in the existing local/library feature, with its existing trust and review policy. It composes on session artifact projection and evidence UI; no image hosting service, remote fetch, test runner replacement or UUID migration.
