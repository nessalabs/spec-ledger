# Detailed claim contracts

The website describes the user-visible behavior in plain language. These technical details preserve the precise checks behind those descriptions; the wording change does not remove or weaken those checks.

## SL-001

A verify verdict is a pure function of ledger files, source tree, and ingested results, and carries digests of those inputs.

## SL-002

Evidence bindings never carry pass/fail status; outcomes live only on results and reports.

## SL-003

The HTTP server has no write endpoints in v1; git is the write path.

## SL-004

Graph node locators that are set must resolve on disk or verify fails.

## SL-005

Reference UI must not import ledger core filesystem APIs; it talks only through the client SDK.

## SL-006

Turn open stamps treeDigest and refuses a dirty worktree unless --allow-dirty is set.

## SL-007

GET /v1/context returns VerticalContext with a stable contextDigest for a sealed workstream slice.

## SL-008

spec-ledger audit exits non-zero when findings match policy.failOn severities.

## SL-011

spec-ledger init creates exactly the normative .spec-ledger/ path table (ledger.json last; vision stub; empty claims/bindings/turns/workstreams/proposed-claims/reviews/themes/tenets; graph+policy files; results/.gitkeep). Re-init when ledger.json exists is refused. After init, verify invents no claim outcome pass and no binding contains status or pass.

## SL-012

At version 0.1.0-alpha.0, packed @nessalabs/spec-ledger installs outside this monorepo and exposes bin spec-ledger that runs --help, init, and verify; packed @nessalabs/spec-ledger-client and @nessalabs/spec-ledger-server contain no workspace: or file: dependency protocols and install/resolve against that ledger version.

## SL-013

Spec Ledger UI for consumers is delivered as a GitHub Release asset (not an npm @nessalabs/spec-ledger-ui package in this bet); the shipped tree has zero file: or workspace: dependency protocols; README documents a one-liner to view a consumer .spec-ledger/ using published client/server plus that asset.

## SL-014

On GitHub Release published events only, .github/workflows/publish.yml publishes @nessalabs/spec-ledger, @nessalabs/spec-ledger-client, and @nessalabs/spec-ledger-server at version equal to the release tag (0.1.0-alpha.0 line) to the nessalabs npm org; pull_request and push must not publish; workflow_dispatch may dry-run; NPM_TOKEN is required for live publish and documented in the workflow.

## SL-015

When a workstream with specPath is sealed, seal.specDocDigest is the sha256 of the UTF-8 bytes at that path and is never rewritten for that seal revision. Last expected doc digest is latest postSealAmends.afterDocDigest if any, else seal.specDocDigest. If sealed with specPath and no expected digest, check-seal and ledger audit fail until workstream backfill-doc-digest. If bytes diverge, check-seal and audit fail until workstream amend. Audit also fails seal-digest-drift when live sealPayload diverges from the seal without re-seal.

## SL-016

Every required binding contributes to a deterministic verdict; failed reports remain readable through both transports.

## SL-017

Reading verification, context, snapshots, and client/server projections does not execute checks or persist reports.

## SL-018

Evidence becomes stale when source or check content changes; code reviews become stale when source changes; required artifacts must retain integrity.

## SL-019

Execution permission honors scoped grants, denial, revocation, current revisions and scoped corrections without claiming host authentication.

## SL-020

Deferred requirements remain discoverable, activate durably for affected work, and prevent completion until their response is satisfied.

## SL-021

Session projections separate implementation from evidence, remain read-only across transports, and enforce current permission at completion.

## SL-022

Workstream evidence preserves current versus recorded results, explains missing coverage, and reads only confined integrity-checked text artifacts without executing checks.

## SL-023

CLI and MCP share validation, permission, persistence and completion gates with equivalent lifecycle outcomes and retry behavior.

## SL-024

Custom workflow satisfaction comes from current typed outputs, and the live UI separates reported progress from inspectable verification.

## SL-025

Best-effort execution activity cannot mint completion or recovery authority; unknown host state and absent capabilities prevent automatic recovery.

## SL-026

Change pages scope current evidence to the recorded turn, separate historical completion, and attribute commits only by exact turn trailers.

## SL-027

A saved check can be inspected and explicitly rerun through shared CLI, MCP and local UI logic with bounded authentic output and safe retry behavior.
