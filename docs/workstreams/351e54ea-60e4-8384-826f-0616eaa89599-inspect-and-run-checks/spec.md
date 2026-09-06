# Inspect and rerun recorded checks

## What exists and what is missing

`packages/ledger/src/verify/execute.ts::checkLedger` executes every command binding synchronously, always with the ledger repository as cwd, a 120-second timeout and 1 MiB output buffer. It discards stdout/stderr, retaining only exit status or a generic failure. It already compares source/check digests before and after execution and marks changed inputs missing. The user cannot currently inspect actual logs because they were not retained, and historical logs cannot be reconstructed honestly.

`schemas/binding.json` records broad kind and locator but has no test level, test source locator, fixture inputs or expected behavior. `schemas/results.json` supports duration, run/source/check identities and artifact hashes, but no structured individual test cases or exit/signal detail. `session/evidence.ts` already projects saved command definitions, current vs recorded outcomes, integrity-checked artifacts and exact-row receipt timestamps. Reuse this projection for the claim page; the current `packages/ui/app/claims/[id]/page.tsx` shows binding intent only.

The generic server must remain GET-only. The existing local browser approval adapter (`permission/local-ui.ts`, reexported through client, used by `/api/approval`) establishes the narrow local-host pattern: same origin, loopback Host, per-process random token, bounded JSON, known fields and conflict detection. Do not extend that approval endpoint into an arbitrary shell API.

## Smallest coherent product change

Each evidence item should show: what behavior the check asserts; kind/level if recorded; source file and optional named test; saved command and repository-relative working directory; inputs/fixtures and expected result if recorded; latest actual result, timing and inspectable output. Missing metadata says “Not recorded”. Exit 0 means the saved command succeeded; it does not identify which assertion ran or prove unspecified expected behavior. Imported reporters may provide structured cases; do not guess expected/actual values by parsing arbitrary terminal output.

First runner version can keep cwd fixed to the canonical repository root and display that explicitly. This already handles correct execution directory for all current bindings. If a real package-local command needs another cwd, add an optional saved `workingDirectory` field to the binding (default `.`), validate realpath confinement and include it in checkFingerprint. Never accept cwd, executable, arguments, environment overrides, command text or artifact output paths from the button request.

Add a small optional binding `test` object (`level`, `description`, `source: {path, name?}`, `inputs`, `expected`) with bounded strings; preserve broad existing kind. For suite inputs that live in source, references are enough. Include these fields in the existing check digest so edits require fresh evidence. Detailed structured test cases should be an optional reporter-produced artifact rather than making every language adopt a mandatory test framework schema.

## Shared execution operation

Expose `run_saved_check` through the shared application dispatcher, CLI and MCP. Input: requestId, bindingId, expectedSourceDigest, expectedCheckDigest. Root comes only from host configuration. Look up the claim and command binding at execution time, reject missing/non-command bindings, compare the exact displayed source/check digest and resolve the saved working directory. An explicit browser click authorizes that saved check execution, not new implementation permission or future unattended execution.

Refactor check execution into one core runner reused by existing `run_checks` and this single-check operation. Single-check completion replaces only its own current result key, retaining unrelated results, and recomputes the report. Serialize result merging or merge against freshly loaded results atomically to prevent two checks losing each other's rows. CLI/MCP batch checks must use the same serialization rather than bypassing it.

Do not block the UI/MCP server event loop with spawnSync. A small owned worker runs the fixed runner executable; the start operation returns a durable run ID and status immediately, and passive `get_check_run` polling shows queued/running/finished/unknown. One running check per repository with an explicit busy response is sufficient initially; no DAG, generic job queue or auto-resume required. The worker must acquire the same execution guard for CLI/MCP/UI paths. Execution runs can finish as pass/fail/missing, while scheduling status is a separate lifecycle. Never treat “request accepted” as “test passed”.

Keep existing request semantics: same requestId+input returns the same run identity; conflicting reuse fails; accepted but unfinished/uncertain requests are never executed again just because a client retries. A crash between durable start and worker launch becomes unknown, not automatic relaunch. A new explicit retry uses a new requestId and records its relation to the prior run. The current runMutation helper is synchronous; do not pass it an async effect that would stamp success before work completes. Use it for the synchronous durable start record only, with worker completion stored separately and immutably.

The local UI bridge accepts only the operation's four identifiers/digests after the approval bridge's same-origin/loopback/token checks, bounded request reading, strict schema and no-store responses. It calls the same operation, returning 202 and run identity; retry returns the same run. Generic HTTP projection routes remain read-only. UI must disable Run again while active and offer refresh on a stale-source/check conflict, not silently execute the new command.

## Output and integrity

Persist bounded stdout/stderr as plain text artifacts associated with the exact run, with byte counts, hashes and an explicit truncation flag. Stream to a bounded file/buffer and continue draining/discarding after the cap; do not keep unbounded logs in memory or responses. Record timestamps, duration, exitCode, signal, timeout/start-error reason, sourceDigest, checkDigest and resolved saved cwd. Retain the command definition snapshot or digest plus a readable snapshot so historical results explain what actually ran.

Use `.spec-ledger/evidence/runs/<id>` for machine receipts and ignored runtime state for in-flight buffers, following existing ownership conventions. Large human walkthroughs remain under `docs/workstreams/.../evidence`. Final logs must use an explicitly excluded generated-artifact area that the verifier still integrity-checks; producing a log must not invalidate its own source digest. Excluding it from source fingerprint is not permission to skip artifact hashes.

Never render logs as HTML or execute terminal escapes. Existing bounded artifact reader can serve text; increase neither its preview limit nor the receipt limit without an explicit bounded design. Logs exceeding preview size need truncation-aware chunks/download with confinement and integrity verification. Secrets are not automatically safe simply because the source is a test; avoid capturing environment dumps and keep artifacts local. A new run can capture output; old discarded output remains “Not captured”.

## Required tests

1. Same saved binding run via CLI, MCP and local UI has equivalent results, cwd and artifacts.
2. Cross-origin/non-loopback/missing-token/oversized/private-command/path injection requests reject without a child process.
3. Source or saved-command changes before start reject; changes during execution yield missing, never pass.
4. Same request retries launch once; conflicting reuse fails; host crash gives unknown and does not silently rerun.
5. Two overlapping requests do not clobber other result rows or run concurrently against the same workspace.
6. Large output, timeouts, startup errors and signals produce bounded inspectable records; UI polling remains responsive.
7. Symlink/path escape, tampered logs and missing artifacts cannot display as intact proof.
8. Browser flow: open criterion, read source/input/expectation or honest absence, Run again, observe running then actual output; no reload or explicit read invokes a check.

## Sequencing

Finish W009 historical evidence retrofit with honest current limitations. Implement this as the next explicit evidence-inspection slice: shared runner/output first, claim/criterion evidence UI second, narrow local Run again adapter last. Reuse the existing client facade and application schemas; do not introduce a parallel browser execution implementation.

## Approved scope for this request

The user requested inspectable test kinds, source/input/expected/actual output and an explicit Run again action in the correct checkout. Implement the shared saved-check operation and narrow local UI bridge; do not deploy or run arbitrary commands supplied by a browser. Existing saved command execution remains authorized through explicit user clicks or CLI/MCP commands. The fixed cwd is the configured repository root in this first version. No new workflow engine or host agent invocation.

Acceptance: a real saved fixture check can be inspected and rerun through CLI, MCP and the local UI; all call the same core logic. The UI stays responsive and shows actual bounded output and source provenance. Missing input/expected/source metadata is explicit. Malformed, cross-origin, stale, conflicting or concurrent requests cannot execute an unintended command or invent a pass. Existing batch checks remain compatible and passive read surfaces remain passive.

Execution ownership clarification: keep the execution guard until the owned child has terminated, including timeout/signal handling. An ambiguous worker crash or orphan remains unknown; elapsed time or a reused PID never authorizes stealing its guard or dispatching again. Saved shell commands are trusted repository code running with the host's privileges, not sandboxed code. No browser-supplied command/cwd/environment is accepted.

Presentation corrections requested during implementation: render source and saved commands with Nessa UI's syntax-highlighted CodeBlock, including source line numbers. Render authored explanatory descriptions as prose. Rewrite visible claim statements as plain, user-observable feature outcomes; preserve their existing precise technical contracts in linked documentation and retain all checks. Apply the same claim-writing guidance to future agent work. These are presentation/data corrections within evidence inspection, not weaker verification requirements.
