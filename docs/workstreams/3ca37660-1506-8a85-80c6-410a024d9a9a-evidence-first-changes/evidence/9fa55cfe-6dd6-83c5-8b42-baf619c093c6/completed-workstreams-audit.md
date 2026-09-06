# Completed workstream audit and MCP verification

Audited all **51 preserved criteria across W-001–W-008**. **17 have existing claim mappings, 29 remain gaps, and 5 describe superseded behavior.** A complete audit does not mean all old features have current proof.

W-005 AC1–7 and W-006–W-008 retain their existing mappings. No new mapping was invented. Inspected implementation supports some old criteria but does not substitute for missing behavioral verification.

Current verdicts were observed while T-039 files were changing and were stale/missing. Re-run saved checks against final source; this report does not overwrite historical completion.

## Coverage

| Workstream | Criteria | Mapped | Gaps | Superseded |
| --- | ---: | ---: | ---: | ---: |
| W-001 — Honest builder turns | 6 | 0 | 6 | 0 |
| W-002 — Full builder runtime | 9 | 0 | 8 | 1 |
| W-003 — Spec Ledger in the browser | 6 | 0 | 4 | 2 |
| W-004 — Spec and code stay coupled | 12 | 0 | 10 | 2 |
| W-005 — Consumer CLI, npm publish, sealed plan digests | 8 | 7 | 1 | 0 |
| W-006 — Trustworthy autonomous coding | 6 | 6 | 0 | 0 |
| W-007 — Review evidence in one place | 1 | 1 | 0 | 0 |
| W-008 — Guide agents and follow verified work | 3 | 3 | 0 | 0 |

## MCP is implemented and tested

**11/11 tests passed** using actual CLI/MCP processes, including packed installation, lifecycle gates, custom workflows, activity signals, and saved-check output. See [test output](mcp-verification.txt). The local executable is `spec-ledger-mcp --root <checkout>`.

Automatic external-agent nudging, verified host liveness, and external-tool cancellation are **not implemented**. The saved-check worker can stop its own timed-out command; that does not confer control of another agent. These tests do not establish installation in a chosen MCP host or npm publication.

## Criterion-by-criterion assessment

### W-001 — Honest builder turns

**AC-1 · gap** — workstream seal + check-seal with immutable seals/1.json

Existing SL-015 overlaps digest preservation but does not fully name seal lifecycle; new scoped claim needed.

Evidence sources: `packages/ledger/src/workstream/doc-digest.break.test.ts`, `packages/ledger/src/workstream/doc-digest.test.ts`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-2 · gap** — spec-ledger context and getVerticalContext share contextDigest

Stable API context tested; exact CLI/API equality not asserted by this test.

Evidence sources: `packages/ledger/src/context/vertical.test.ts`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-3 · gap** — turn open --workstream stamps opened.contextDigest; unsealed open refused

Behavior test exists, but SL-006 only describes dirty/tree gate. Add scoped claim before mapping.

Evidence sources: `packages/ledger/src/turns/close.test.ts`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-4 · gap** — turn close can refuse missing code-break for workstream turns

Behavior test exists; no standing claim precisely represents review-close gate.

Evidence sources: `packages/ledger/src/turns/close.test.ts`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-5 · gap** — closed workstream turn visible on existing Lattice feature/turn pages

Feature detail filters linked turns with turnsTouchingFeature and renders TurnSummaryCard; turn detail reads getTurnEpisode and its workstream. Current source supports navigation, but a closed-workstream browser fixture after the UI changes is still needed.

Evidence sources: `packages/ui/app/features/[id]/page.tsx`, `packages/ui/app/turns/[id]/page.tsx`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-6 · gap** — workstream/context files do not change verify ledgerDigest

Existing test calls verifier twice without changing metadata: insufficient assertion of independence. Add mutation-based test.

Evidence sources: `packages/ledger/src/context/vertical.test.ts`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

### W-002 — Full builder runtime

**AC-1 · gap** — turn check recomputes facts without writing; turn abandon writes facts with status abandoned

No direct check-no-write/abandon facts behavior assertion found.

Evidence sources: `packages/ledger/src/episodes.write.test.ts`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-2 · gap** — open stamps treeDigest; refuses dirty unless --allow-dirty

Upgrade SL-006 path binding and add explicit dirty-refusal test if not in latest suite; current named turn test permits dirty.

Evidence sources: `packages/ledger/src/git/tree.test.ts`, `packages/ledger/src/turns/close.test.ts`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-3 · gap** — GET /v1/context returns VerticalContext; client HTTP path works

SL-007 binding is only routes.ts existence. Need actual HTTP client context test.

Evidence sources: `packages/ledger/src/context/vertical.test.ts`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-4 · superseded** — automation events resume timeouts on context/open; close refuses blocked events

Original resume-on-context behavior intentionally superseded by W006 read purity. Do not claim old acceptance passing; record supersession. This audit records the conflict with later authorized behavior; it does not silently amend the preserved requirement.

Evidence sources: `packages/ledger/src/runtime.p0.test.ts`, `packages/ledger/src/verify/readonly.break.test.ts`.

Next: Record the newer requirement as superseding this historical contract; retain old evidence/history.

**AC-5 · gap** — spec-ledger related --workstream returns claims/features/turns/docs pack

Related function checked, not CLI shape. No exact standing claim.

Evidence sources: `packages/ledger/src/runtime.p0.test.ts`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-6 · gap** — decisions/sources/attachments/probes/flows loadable; decision basis stamped on close when present

Test runs real side-collection CLI and close; add scoped claim for mapping.

Evidence sources: `packages/ledger/src/episodes.write.test.ts`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-7 · gap** — spec-ledger audit + policy/audit.json; CI runs verify + audit + test

Current test checks audit shape only, not policy nonzero exit. SL-008 path binding insufficient; CI config inspection required.

Evidence sources: `packages/ledger/src/runtime.p0.test.ts`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-8 · gap** — Lattice /compass and /timeline render vision/tenets/turns

Compass renders vision, tenets and themes from getCompass. Timeline explicitly redirects to /turns. A browser observation of populated compass and redirected turn history is missing; the original route no longer renders its own timeline.

Evidence sources: `packages/ui/app/compass/page.tsx`, `packages/ui/app/timeline/page.tsx`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-9 · gap** — proposed-claims dir + list; themes optional; dogfood turn under W-002

Dogfood turn metadata can establish historical use; proposals/themes behavior not meaningfully asserted.

Evidence sources: `packages/ledger/src/runtime.p0.test.ts`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

### W-003 — Spec Ledger in the browser

**AC-1 · superseded** — pnpm lattice boots against this repo .spec-ledger

The root package scripts contain ui and ui:prod, but no lattice. This records the naming successor and conflict with the preserved command; it does not claim the literal original command passes.

Evidence sources: `package.json`.

Next: Record the newer requirement as superseding this historical contract; retain old evidence/history.

**AC-2 · superseded** — / shows workstream pulse + open turn or empty state + live verify badge

The home route now loads getSession and renders LiveSession. W009 expressly specifies current acceptance evidence and historical completion revalidation on Now; this replaces the old pulse/open-turn/live-badge layout. The old layout is not being passed retroactively.

Evidence sources: `packages/ui/app/page.tsx`, `docs/workstreams/W-009-evidence-first-changes/spec.md`.

Next: Record the newer requirement as superseding this historical contract; retain old evidence/history.

**AC-3 · gap** — /workstreams and /workstreams/[id] show status, seal, slices, linked turns

The index uses listWorkstreams; detail reads status, seal metadata, current evidence, and turns filtered by workstreamId. No current browser fixture establishes every original slice/status/link requirement; preserve this gap.

Evidence sources: `packages/ui/app/workstreams/page.tsx`, `packages/ui/app/workstreams/[id]/page.tsx`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-4 · gap** — /turns/[id] shows workstream/slice/contextDigest + reviews/decisions/attachments

The route reads getTurnEpisode and workstream; TurnDetail renders the scoped plan, reviews, decisions and evidence. Its Ledger internals shows ledgerDigest/resultsDigest, but no explicit contextDigest display was found. The full original metadata/artifact contract needs a focused browser assertion and possibly a display correction.

Evidence sources: `packages/ui/app/turns/[id]/page.tsx`, `packages/ui/components/turn-detail.tsx`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-5 · gap** — Nav includes Workstreams; product chrome says Spec Ledger not Lattice

The WORK navigation contains Workstreams; the shell visibly renders specLedger and uses Spec Ledger in its tooltip. This source inspection supports the current brand/navigation but is not a complete browser or all-copy assertion, especially for preserved historical prose.

Evidence sources: `packages/ui/components/spec-ledger-shell.tsx`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-6 · gap** — Client listWorkstreams/getWorkstream + turn episode helpers; UI uses client only

The client implements listWorkstreams, getWorkstream and getTurnEpisode for local and HTTP surfaces; inspected UI routes use the client facade. These source examples do not establish a repository-wide import boundary or complete behavioral API contract. A precise claim and focused tests remain needed.

Evidence sources: `packages/client/src/index.ts`, `packages/ui/app/workstreams/[id]/page.tsx`, `packages/ui/app/turns/[id]/page.tsx`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

### W-004 — Spec and code stay coupled

**AC-1 · superseded** — Human-reviewed bet prose lives under docs/workstreams/ as a title-slug Markdown file; .spec-ledger holds JSON metadata only and links via specPath (repo-relative)

W006 explicitly assigns main prose to docs/workstreams/W-…/spec.md and artifacts to evidence/<run-id>/. This later directory contract supersedes the original flat title-slug shape; the preserved requirement is not silently changed or passed.

Evidence sources: `docs/workstreams/W-006-trustworthy-autonomous-coding/spec.md`.

Next: Record the newer requirement as superseding this historical contract; retain old evidence/history.

**AC-2 · gap** — Sidebar wordmark is specLedger (bold 'spec', regular 'Ledger'); no 'Bets → turns → claims' subtitle under the brand

The current shell still renders spec with font-semibold and Ledger with font-normal, without a subtitle. The original typography has not actually been superseded. Source supports it; a focused rendered observation is absent, so retain a verification gap.

Evidence sources: `packages/ui/components/spec-ledger-shell.tsx`.

Next: Observe the current wordmark in the browser and attach a scoped verification record.

**AC-3 · superseded** — Turn detail leads with plan loaded from workstream specPath Markdown (before/after + ask), before→after diagram or flows, commit subject/body, related docs; FileDiffCard lists product files; build artifacts (.next, node_modules) excluded from impact lists

W009 explicitly requires evidence before secondary technical details. TurnDetail places TurnEvidence directly below its header, before before/after and plan details. This is a documented successor to original plan-first order, not proof of the original ordering.

Evidence sources: `docs/workstreams/W-009-evidence-first-changes/spec.md`, `packages/ui/components/turn-detail.tsx`.

Next: Record the newer requirement as superseding this historical contract; retain old evidence/history.

**AC-4 · gap** — Architecture touch shows workstream link + named features (+ claim count), not only bare node ids

Architecture touch renders the workstream link, named feature badges, node lists and claim chips; its summary counts workstreams/features, but an explicit claim count is not rendered by ChipRow. A targeted UI check and a decision on the original claim-count expectation remain needed.

Evidence sources: `packages/ui/components/turn-detail.tsx`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-5 · gap** — Verify page: covered totals (e.g. required pass/total) plus each verdict row shows claim statement primary and id secondary

Verify renders Required covered as requiredPass/required.length and puts claim.statement ahead of secondary id/kind/detail. This is inspected implementation support; no focused current rendered assertion is attached to this criterion.

Evidence sources: `packages/ui/app/verify/page.tsx`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-6 · gap** — Claims/features/bets/turns index rows stay compact

ClaimsList and features use divided compact rows; workstreams uses WorkstreamsList and turns passes compact to TurnSummaryCard. Source supports the row approach, but the full responsive/browser acceptance remains unverified.

Evidence sources: `packages/ui/components/claims-list.tsx`, `packages/ui/app/features/page.tsx`, `packages/ui/app/workstreams/page.tsx`, `packages/ui/app/turns/page.tsx`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-7 · gap** — Align coverage: product path is covered if it matches a graph node.locator under the turn's featureIds OR a slice expectedPaths[] entry; .spec-ledger/** and ignore globs exempt; uncovered paths reported

Behavior suites exist but no SL-009 claim is present: create scoped coverage claim.

Evidence sources: `packages/ledger/src/align/check.break.test.ts`, `packages/ledger/src/align/check.test.ts`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-8 · gap** — Code-target align approve requires treeDigest, coverageSource, uncoveredPaths (empty) or waiverIds; reviewer starts with policy.alignReviewerPrefix and must not equal turn producer

Behavior suites exist but no SL-010 claim is present: create scoped approval claim.

Evidence sources: `packages/ledger/src/align/approve.test.ts`, `packages/ledger/src/align/break.test.ts`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-9 · gap** — Explicit skip writes align-waiver JSON: reason (>= policy.alignWaiverMinReasonChars), actor, treeDigest, workstreamId/turnId; max alignSkipMaxPerTurn; silence is not skip; audit lists waivers

Existing suites cover forged/invalid waiver refs; add direct minimum reason/max-per-turn and waiver audit tests if mapping full criterion.

Evidence sources: `packages/ledger/src/align/break.test.ts`, `packages/ledger/src/align/check.break.test.ts`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-10 · gap** — turn close refuses product-file turns without covering align-approve or waiver for that treeDigest when requireAlignApprove

Existing align suites exercise refusal; needs scoped align gate claim.

Evidence sources: `packages/ledger/src/align/break.test.ts`, `packages/ledger/src/align/check.break.test.ts`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-11 · gap** — scripts/git-hooks pre-push (+ documented pre-PR) and CI step 'pnpm ledger:align' fail without approve/waiver for product diffs; pnpm verify / verify workflow remain claims-pure and separate

The pre-push hook executes align check and fails on error; CI runs ledger:align separately from verify and audit. This inspection does not execute a rejecting push/PR fixture or establish that hooks are installed in every checkout. Keep the end-to-end gate gap.

Evidence sources: `scripts/git-hooks/pre-push`, `.github/workflows/ci.yml`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

**AC-12 · gap** — skills/sl-dev-align/SKILL.md exists and AGENTS.md points hosts at it: cheap/Haiku-class model, ask user for coverage intent before approve

The skill specifies cheap coverage review, source/claim rationale and user coverage intent; AGENTS links it before close/push. This is directly inspected guidance, not behavioral proof that any agent follows it. Existing session authorization can supply intent under the current skill.

Evidence sources: `skills/sl-dev-align/SKILL.md`, `AGENTS.md`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

### W-005 — Consumer CLI, npm publish, sealed plan digests

**AC-1 · mapped** — spec-ledger init creates exactly the normative skeleton table in docs/workstreams/consumer-cli-and-npm-publish.md; re-init refuses; ledger.json written last

Existing acceptance mapping is supported by the saved behavioral command suites listed below. Current passing evidence must be recomputed after T-039 changes; mapping is not a passing outcome.

Evidence sources: `packages/ledger/src/cli/init.break.test.ts`, `packages/ledger/src/cli/init.test.ts`.

Existing mappings: SL-011. Current observed evidence: missing: b-sl-011: evidence is stale for the current source or check

Next: Retain mapping; run its saved checks after source changes and inspect current results.

**AC-2 · mapped** — After init, verify invents no claim pass and no binding carries status/pass (SL-001, SL-002)

Existing acceptance mapping is supported by the saved behavioral command suites listed below. Current passing evidence must be recomputed after T-039 changes; mapping is not a passing outcome.

Evidence sources: `packages/ledger/src/cli/init.break.test.ts`, `packages/ledger/src/cli/init.test.ts`.

Existing mappings: SL-011. Current observed evidence: missing: b-sl-011: evidence is stale for the current source or check

Next: Retain mapping; run its saved checks after source changes and inspect current results.

**AC-3 · mapped** — Packed @nessalabs/spec-ledger@0.1.0-alpha.0 installs outside the monorepo; bin spec-ledger runs --help, init, verify

Existing acceptance mapping is supported by the saved behavioral command suites listed below. Current passing evidence must be recomputed after T-039 changes; mapping is not a passing outcome.

Evidence sources: `packages/ledger/src/pack.break.test.ts`, `packages/ledger/src/pack.concurrency.break.test.ts`, `packages/ledger/src/pack.smoke.test.ts`.

Existing mappings: SL-012. Current observed evidence: missing: b-sl-012: evidence is stale for the current source or check

Next: Retain mapping; run its saved checks after source changes and inspect current results.

**AC-4 · mapped** — Packed client and server package.json contain no workspace: or file: deps; install resolves against packed ledger

Existing acceptance mapping is supported by the saved behavioral command suites listed below. Current passing evidence must be recomputed after T-039 changes; mapping is not a passing outcome.

Evidence sources: `packages/ledger/src/pack.break.test.ts`, `packages/ledger/src/pack.concurrency.break.test.ts`, `packages/ledger/src/pack.smoke.test.ts`.

Existing mappings: SL-012. Current observed evidence: missing: b-sl-012: evidence is stale for the current source or check

Next: Retain mapping; run its saved checks after source changes and inspect current results.

**AC-5 · mapped** — Spec Ledger UI ships as GitHub Release asset only (not npm UI); artifact has zero file: or workspace: deps; README one-liner documents viewing a consumer ledger via published client/server

Existing acceptance mapping is supported by the saved behavioral command suites listed below. Current passing evidence must be recomputed after T-039 changes; mapping is not a passing outcome.

Evidence sources: `packages/ledger/src/ui-release.break.test.ts`, `packages/ledger/src/ui-release.smoke.test.ts`.

Existing mappings: SL-013. Current observed evidence: missing: b-sl-013: evidence is stale for the current source or check

Next: Retain mapping; run its saved checks after source changes and inspect current results.

**AC-6 · mapped** — .github/workflows/publish.yml live-publishes only on release published to the nessalabs npm org/registry; optional workflow_dispatch dry-run; ci.yml does not publish; version must match release tag; NPM_TOKEN documented

Existing acceptance mapping is supported by the saved behavioral command suites listed below. Current passing evidence must be recomputed after T-039 changes; mapping is not a passing outcome.

Evidence sources: `packages/ledger/src/publish.workflow.break.test.ts`, `packages/ledger/src/publish.workflow.test.ts`.

Existing mappings: SL-014. Current observed evidence: missing: b-sl-014: evidence is stale for the current source or check

Next: Retain mapping; run its saved checks after source changes and inspect current results.

**AC-7 · mapped** — workstream seal stamps seal.specDocDigest for specPath (immutable for that revision); sealed+specPath with no expected digest fails check-seal and audit (spec-doc-digest-missing) until workstream backfill-doc-digest writes a new seal revision; drift fails when expected digest exists; workstream amend appends postSealAmends without mutating seal; ## Modifications is the human log; audit error seal-digest-drift for JSON sealPayload vs snapshot

Existing acceptance mapping is supported by the saved behavioral command suites listed below. Current passing evidence must be recomputed after T-039 changes; mapping is not a passing outcome.

Evidence sources: `packages/ledger/src/workstream/doc-digest.break.test.ts`, `packages/ledger/src/workstream/doc-digest.test.ts`, `packages/ledger/src/workstream/pr1-regressions.break.test.ts`.

Existing mappings: SL-015. Current observed evidence: missing: b-sl-015: evidence is stale for the current source or check

Next: Retain mapping; run its saved checks after source changes and inspect current results.

**AC-8 · gap** — This bet is done with workflow+docs+dry-run + digest/amend gates; cutting the first Release is optional human action

The source spec explicitly makes cutting the first GitHub Release an optional human action outside acceptance. This is a scope condition, not a command result. Workflow/dry-run evidence remains under AC6; actual publication is not established.

Evidence sources: `docs/workstreams/consumer-cli-and-npm-publish.md`.

Next: Keep this gap visible; add the named missing behavioral or browser verification and a precise claim before mapping.

### W-006 — Trustworthy autonomous coding

**SLC-01/AC-1 · mapped** — AC-05: Fail dominates missing, which dominates attested, which dominates pass; order never changes the result. Duplicate result keys are rejected. Empty ledgers show no requirements checked.

Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.

Evidence sources: `packages/ledger/src/verify/aggregation.break.test.ts`.

Existing mappings: SL-016. Current observed evidence: missing: b-sl-016: evidence is stale for the current source or check

Next: Retain mapping; run its saved checks after source changes and inspect current results.

**SLC-02/AC-1 · mapped** — AC-06: CLI execution and report persistence are explicit; client/server/context reads do not run commands, write reports, or resume automation.

Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.

Evidence sources: `packages/ledger/src/verify/readonly.break.test.ts`.

Existing mappings: SL-017. Current observed evidence: missing: b-sl-017: evidence is stale for the current source or check

Next: Retain mapping; run its saved checks after source changes and inspect current results.

**SLC-03/AC-1 · mapped** — AC-06/09: Relevant dirty and untracked content changes invalidate results and reviews; metadata-only changes and content-preserving commits do not. Artifact references are confined and integrity checked.

Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.

Evidence sources: `packages/ledger/src/evidence/fingerprint.break.test.ts`.

Existing mappings: SL-018. Current observed evidence: missing: b-sl-018: evidence is stale for the current source or check

Next: Retain mapping; run its saved checks after source changes and inspect current results.

**SLC-04/AC-1 · mapped** — AC-01/02: Revision approval, request and standing delegation are distinct; denial/revocation blocks affected work. Corrections are scoped, provenance is honest, context hashes content.

Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.

Evidence sources: `packages/ledger/src/permission/authority.break.test.ts`.

Existing mappings: SL-019. Current observed evidence: missing: b-sl-019: evidence is stale for the current source or check

Next: Retain mapping; run its saved checks after source changes and inspect current results.

**SLC-05/AC-1 · mapped** — AC-03/04: Old unresolved linked deferrals appear independent of recent history; activation is persistent and idempotent, unknown inputs stay unknown, completion requires a valid response. Backlog projects drafts and deferrals.

Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.

Evidence sources: `packages/ledger/src/deferrals/deferrals.break.test.ts`, `packages/ledger/src/deferrals/index.test.ts`, `packages/ledger/src/deferrals/portability.test.ts`.

Existing mappings: SL-020. Current observed evidence: missing: b-sl-020: evidence is stale for the current source or check

Next: Retain mapping; run its saved checks after source changes and inspect current results.

**SLC-06/AC-1 · mapped** — AC-07/08: Session shows meaningful progress, current evidence, and approval state. Local UI records revision-bound approve/deny; approved work has no repeated prompt. Portable CLI remains available.

Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.

Evidence sources: `packages/ledger/src/graph/display.test.ts`, `packages/ledger/src/permission/local-ui.break.test.ts`, `packages/ledger/src/session/session.break.test.ts`.

Existing mappings: SL-021. Current observed evidence: missing: b-sl-021: evidence is stale for the current source or check

Next: Retain mapping; run its saved checks after source changes and inspect current results.

### W-007 — Review evidence in one place

**SLC-01/AC-1 · mapped** — Workstream evidence explains current verdicts, recorded checks, reviews and safe artifacts; custom workflows have a concrete proposal.

Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.

Evidence sources: `packages/ledger/src/session/evidence.break.test.ts`.

Existing mappings: SL-022. Current observed evidence: missing: b-sl-022: evidence is stale for the current source or check

Next: Retain mapping; run its saved checks after source changes and inspect current results.

### W-008 — Guide agents and follow verified work

**SLC-01/AC-1 · mapped** — A real CLI and MCP work loop has equivalent validation, effects and evidence gates and appears in the existing session view.

Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.

Evidence sources: `packages/ledger/src/application/operations.break.test.ts`, `packages/ledger/src/application/receipts.break.test.ts`, `packages/mcp/src/lifecycle.test.ts`.

Existing mappings: SL-023. Current observed evidence: missing: b-sl-023: evidence is stale for the current source or check

Next: Retain mapping; run its saved checks after source changes and inspect current results.

**SLC-02/AC-1 · mapped** — Default and custom local methods preserve snapshots, enforce typed output gates and show live progress and inspectable evidence in the UI.

Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.

Evidence sources: `packages/ledger/src/workflows/workflow.break.test.ts`, `packages/ledger/src/workflows/workflow.test.ts`, `packages/mcp/src/workflow.lifecycle.test.ts`.

Existing mappings: SL-024. Current observed evidence: missing: b-sl-024: evidence is stale for the current source or check

Next: Retain mapping; run its saved checks after source changes and inspect current results.

**SLC-03/AC-1 · mapped** — Execution associations and bounded activity handle missing and duplicated signals honestly; optional recovery readiness honors policy and available host capabilities.

Rerun after final source freeze; old implementation reports/reviews are historical. Do not mark current implementation merely from old done status.

Evidence sources: `packages/ledger/src/execution/execution.break.test.ts`, `packages/mcp/src/execution.lifecycle.test.ts`.

Existing mappings: SL-025. Current observed evidence: missing: b-sl-025: evidence is stale for the current source or check

Next: Retain mapping; run its saved checks after source changes and inspect current results.
