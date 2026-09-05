# Trustworthy autonomous coding

**W-006 · Implementation direction · September 4, 2026**

Spec Ledger helps people supervise agent-written software through readable specs, explicit permission, meaningful progress, and evidence tied to the code being reviewed.

The user authorized implementation of this direction on September 4, 2026, after the PR 1 fixes, and selected a portable CLI approval handoff first. This authority is reported from the conversation; it is not a host-verified consent token. Implementation preserves standing seal history and explicitly revises policy when delegated execution becomes available. [Initial review evidence](review-notes.md) is separate because the implementation is changing in parallel.

## The product

A user describes what they want and chooses how much to delegate. The agent plans against existing specs and decisions, implements within that authority, and records the changes and checks that matter. The user follows a clear session view instead of reading a tool log.

At any point, the user can answer:

- What are we building, and what counts as done?
- What can the agent decide without me?
- What changed from the plan, including earlier work we deferred?
- What has current evidence, and what remains uncertain?
- Do I need to decide anything, and where can I try the result?

The promise is traceable requirements and honest evidence. Tests cannot prove complete equivalence between arbitrary prose and code. Skills improve engineering discipline; runtime checks and CI enforce the rules that can be checked mechanically.

## One workflow: plan → work → check

| Step | Agent responsibility | What the user sees |
| --- | --- | --- |
| Plan | Read relevant specs, corrections, backlog, and deferrals; propose acceptance; establish permission; review meaningful risks. | The intended outcome, scope, relevant prior commitments, and any decision needed. |
| Work | Implement a bounded slice; preserve the active spec revision; record meaningful changes and newly discovered obligations. | Progress, deviations, blockers, and a preview when available. |
| Check | Run required checks, obtain proportionate independent review, resolve due obligations, and evaluate completion. | What passed on this version, what failed or is missing, and what remains unfinished. |

These are workflow entry points, not a requirement to replace every existing CLI command. Reuse `related`, context, decisions, reviews, evidence, and turn lifecycle operations. Return one bounded context containing the next permitted action and missing prerequisites. Skills explain good engineering; shared runtime rules decide eligibility.

## 1. Keep intent, permission, and proof separate

A spec revision defines the intended behavior. Permission establishes whether work may proceed. Evidence supports whether the behavior is implemented. None substitutes for another.

| User choice | Permission to proceed |
| --- | --- |
| Manual approval | Approval of the specific spec revision. |
| Autonomy for this request | Explicit delegation covering this request. |
| Standing autonomy | An applicable saved delegation, until revoked or superseded. |

Record the source instruction, scope, exclusions, and applicable revision/delegation. Display “Approved by you” or “Proceeding under your delegation” accurately. A model-written human name is not verified consent; distinguish host-captured permission from agent-reported provenance.

Request-specific restrictions override broader defaults. Vision guides choices but does not grant permission. Silence and timeouts never expand authority. A denied revision cannot restart under the same standing delegation; denial does not revoke permission for unrelated work. Revocation stops the next dependent action, with any in-flight work reported honestly.

Agents may amend plans within delegated scope, preserving the previous revision and recording the reason. Out-of-scope changes require further authorization. Enforce explicit limits mechanically; attribute semantic scope judgments to the agent/reviewer and surface unresolved ambiguity before dependent work proceeds.

## 2. Plan with memory, not just the latest prompt

Use the existing `spec-ledger related` lookup during both planning and spec review. Extend it to include relevant specs, claims, decisions, corrections, unresolved deferrals, and optional backlog candidates, with a reason for each match.

Explicit feature, claim, interface, and dependency links are the reliable starting point. Graph neighbors and semantic matches help the reviewer discover possible interactions; they are not proof that every interaction has been found. Old unresolved obligations must remain discoverable independently of recent-turn limits. Report unavailable sources and truncated results; never turn an incomplete search into “nothing relevant.”

Corrections have a source and scope. Apply explicit request corrections immediately within that scope. Keep inferred global preferences unconfirmed. Superseded guidance stays in history but leaves active context. A correction that changes approved acceptance follows the amendment rules rather than silently replacing it. Hash the content of applicable context, not merely its record IDs; this proves what was supplied, not that a model understood it.

### Backlog ownership

Users can keep planning work in their preferred tool or locally:

- **External tool:** owns task descriptions, priorities, assignments, and discussion. Spec Ledger stores a stable reference, not a second editable task copy.
- **Local backlog:** a view over draft workstreams and deferred decisions. A raw idea can remain an unshaped note; it does not require an implementation turn.
- **Spec Ledger:** owns spec revisions, obligations, permission, and evidence regardless of where a task is tracked.

During planning, surface **must address**, **worth including**, and **still deferred**. Only explicit obligations create gates; ordinary candidates and fuzzy search matches do not. The agent decides within its authority or asks when a real decision exceeds it.

A plan may proceed by including the work needed to resolve an obligation. Planning must account for it; satisfaction is required at its declared completion/release checkpoint, not before the agent can begin fixing it.

Follow the user's destination preference. Create external tasks only with authorization and available access; otherwise retain the item locally and provide a ready-to-create handoff. Reconcile uncertain creation responses before retrying so issues are not duplicated. Closing an external issue is not proof that its requirement is satisfied.

## 3. Make “later” a recorded commitment

A deferred decision attaches to the spec that justified postponement and identifies where it should resurface. The origin answers “why did we defer this?” Applicability answers “which future work should revisit it?” Linking only to the old spec is insufficient.

Example:

> We are single-user, so defer tenant isolation. When a multi-user feature enters an executable plan, bring this decision back. Require verified isolation before that feature is completed.

Capture only the essentials:

| Field | Meaning |
| --- | --- |
| Origin and reason | The spec/decision and why postponement is acceptable now. |
| Deferred work | What remains to be revisited or implemented. |
| Applicability and trigger | The referenced feature/requirement and observable condition that makes it due. |
| Required response and gate | Revisit a decision, or satisfy a requirement before a named transition. |
| Resolution | Evidence or an authorized dismissal, cancellation, or re-deferral. |

Start with **one trigger: a referenced feature entering an executable plan**, and a gate before that feature is completed. Surface possible relevance earlier during planning. Add other predicates only when a real obligation needs them; do not build a general rules engine.

The evaluator returns **not due**, **due**, or **unknown**. Missing references are unknown, not false. Once activated, the obligation stays open until resolved; removing/re-adding the feature or restarting the agent cannot erase it. Repeated evaluation must not duplicate activation.

“Revisit” can be satisfied by an authorized recorded decision. “Implement” requires current evidence. Creating a task or saying “noted” satisfies neither automatically. Re-deferral preserves the old commitment and requires rationale and applicable authority; it cannot bypass a hard requirement.

Evaluate obligations at planning and work checkpoints, and recheck against the same inputs before advancing a gated action. Read-only lookups project the result; authorized writes persist transitions. Block only affected work. Release enforcement can be added where CI/publishing invokes the gate; the ledger cannot intercept arbitrary external actions.

No background scheduler is required. The next relevant operation performs the evaluation. Vague conditions such as “when this gets complicated” remain review prompts until made observable.

## 4. Make evidence trustworthy before making it green

Separate check execution, pure verdict evaluation, and persistence. HTTP/UI reads may inspect current files or run read-only Git queries, but must not execute evidence bindings, write reports, or advance automation state.

Every required check contributes to the verdict. A passing check cannot hide a failure or missing result. Reject ambiguous duplicate results. A path check proves existence only; behavioral claims need behavioral evidence. Human attestation stays distinct, and an empty ledger displays “No requirements checked.”

A result identifies the requirement/check revision, source-content fingerprint, producer, outcome, and evidence. Tool-generated fingerprints cover relevant dirty and untracked source. Start conservatively with product-wide content; exclude declared generated outputs. Changed inputs during execution invalidate the result. Unavailable observations produce unknown freshness.

Code changes invalidate dependent evidence and reviews. Old scope approvals cannot cover newly changed files. Content-preserving commits, progress updates, and report writes do not invalidate unchanged code evidence. A permission change affects eligibility without necessarily requiring tests to rerun.

Keep these answers separate in the UI and API:

- **Allowed:** applicable permission exists.
- **Implemented:** the agent reports the acceptance item built.
- **Verified:** required evidence is current and satisfies the checks.
- **Complete:** acceptance, required reviews, due obligations, and permission all satisfy completion policy.

Existing `verify.ok` remains a claims-verification result. It does not mean the entire feature is complete. Shared completion logic joins these records without making narrative progress into proof. Reviewers still assess whether tests actually cover the intended behavior; fingerprints establish correspondence, not the honesty of an untrusted producer.

### Where records and artifacts live

**`.spec-ledger/` holds machine-readable records; the workstream folder holds documents and artifacts those records reference.** Keep one authoritative record for each fact, rather than hand-maintaining matching summaries in both places.

| Content | Location |
| --- | --- |
| Main spec and supporting explanations | `docs/workstreams/W-…/spec.md` and optional notes beside it |
| Logs, screenshots, raw test reports, and recordings | Workstream `evidence/<run-id>/`, or external artifact storage for large files |
| Claims, check bindings, run identity/outcome, input fingerprints, and artifact references | `.spec-ledger/` |
| Decisions, permissions, deferrals, formal reviews, immutable spec snapshots, and computed verification reports | `.spec-ledger/` |

```text
docs/workstreams/W-006-trustworthy-autonomous-coding/
  spec.md
  review-notes.md
  evidence/
    <run-id>/
      test-output.txt
      results.json
      screenshot.png
```

The tool creates a ledger evidence record linking the run to its acceptance criterion or claim, command/check, outcome, exact source/spec/check fingerprints, and artifact paths or URLs with content hashes. Resolve local paths from the repository root and validate that they stay within the permitted checkout. No separate hand-written manifest is required inside each run folder. Reuse the evidence contract; this layout does not introduce another verdict system.

A test runner's `results.json` is a raw artifact. The ledger's normalized result records its interpretation and provenance. Formal approvals belong in ledger review records; `review-notes.md` contains optional background, not a second approval. File presence alone proves neither success nor relevance: screenshots support visual observations, while logs support what a particular check reported.

Use a new directory per run and preserve prior evidence rather than overwriting “latest.” Capture useful output, screenshots, and reports selectively, not every tool call or reasoning trace. Label excerpts with their source and line range/full-log reference when available. Remove credentials and sensitive data before persistence; hash the retained artifact and disclose redaction where it affects interpretation.

Commit small, durable artifacts; reference large recordings and build outputs in CI/artifact storage. Missing, expired, or hash-mismatched required artifacts cannot support a current verified result. Historical outcomes remain visible as history. Exclude declared evidence outputs from source fingerprints to avoid invalidating a run by saving its own log; hash artifacts separately and never exempt arbitrary source merely because it was placed in an evidence directory.

Adopt the optional folder convention first. Implement automatic collection and integrity checks with the evidence contract, without expanding the initial aggregation fix.

## 5. Show one calm session

The default session screen shows:

1. **Goal and permission:** outcome, active spec revision, and delegation scope.
2. **Needs attention:** decisions, due deferrals, and failures that stop progress.
3. **Acceptance:** implementation and evidence states per criterion.
4. **Meaningful changes:** completed behavior, deviations with before/after and reason, and resolved blockers.
5. **Try it:** preview/artifact with its revision and availability.

Use “3 of 5 criteria have current passing evidence,” not a percentage inferred from tool calls. A changed acceptance denominator appears as a spec revision. Technical logs, files, and hashes are expandable. Keep routine reasoning out of the default feed.

Derive the view from existing records, coalesce duplicate updates, and poll side-effect-free projections initially. Show last observation time and disconnected/stale states. Select a session explicitly when several workstreams are active; open turns are not shipped work. Specs and history remain accessible; graph and schema inspection become advanced views.

For approve/deny, use a host bridge that captures the user action and invokes authorized CLI writes. Bind decisions to a revision and make retries idempotent. Show success only after persistence. Without a bridge, offer a clearly labeled handoff to the agent; do not pretend a standalone read-only browser can record approval. External text and links are untrusted data, and paths/IDs must be validated at boundaries.

## Acceptance for the product direction

These are the canonical draft criteria. W-006 JSON holds indexing metadata; do not maintain a second hand-written acceptance contract. Detailed implementation specs should reference these stable IDs.

| ID | Observable outcome | Required validation |
| --- | --- | --- |
| AC-01 | Manual, request-scoped, and standing permission lead to distinct, correct eligibility; denied/revoked authority cannot silently resume affected work. | Permission transition and restart tests. |
| AC-02 | A second agent receives an applicable correction without chat history; superseded guidance is inactive and same-ID content changes alter context identity. | Scoped context/handoff tests. |
| AC-03 | Planning retrieves an old linked deferral despite newer turns; optional backlog items remain optional and missing external discovery is visible. | Related-pack and unavailable-provider fixtures. |
| AC-04 | A multi-user plan activates the isolation obligation; affected completion is blocked until the required response is satisfied, including across retry/restart. | Trigger, unknown-input, re-deferral, and completion tests. |
| AC-05 | Pass-plus-fail cannot pass in either order; missing/duplicate results remain honest and failures render through every supported client. | Aggregation tests and failure-to-UI scenario. |
| AC-06 | Changed source/checks stale prior evidence and approvals; harmless metadata churn does not; reads perform no effectful operations. | Mutation, replay, and read-side-effect tests. |
| AC-07 | The session accurately displays mixed acceptance states, meaningful updates, due obligations, preview availability, and disconnects. | Browser walkthrough answering the five product questions. |
| AC-08 | The portable CLI completes plan/work/check with revision-bound decisions. The local Spec Ledger UI host records approve/deny directly, only while a decision is needed; other hosts can retain the explicit CLI handoff. | Consumer smoke test and host contract tests. |
| AC-09 | Ledger records reference run-specific artifacts without duplicate authoritative results; artifacts are traceable to criteria and input revisions, and missing/tampered required evidence cannot appear current. | Artifact capture/reference/integrity tests, including evidence-output exclusion and large-artifact links. |

Independent review should target meaningful failure modes, scaled to the actual trust profile. Use the existing engineering guidance for small boundaries, failure-first design, and inexpensive future changes. Preserve independent adversarial review; automate deterministic scope checks rather than adding repeated manual ceremony.

## Delivery and boundaries

**First vertical: every required check matters (AC-05).** Correct result aggregation, reject ambiguous result keys, and carry failed reports through the client to the UI. Prove it with focused tests and one visible failure scenario. Do not fold autonomy or freshness redesign into this first change.

Then deliver bounded verticals in this order:

1. Current evidence, side-effect-free reads, review/coverage freshness, and artifact provenance—separate changes within AC-06 and AC-09.
2. Permission and correction context—AC-01 and AC-02.
3. Related-spec deferrals and local backlog discovery—AC-03 and AC-04.
4. The session view and portable CLI approval handoff—AC-07 and AC-08.

Ship the portable CLI/local path first. Add an external planning adapter only after the user chooses a provider. Consolidate skills around plan/work/check when the shared runtime operations exist, retaining focused breaker/security/learning procedures and compatibility aliases.

Keep the existing ledger/client/server/UI package boundaries and Git-backed records. UI depends on the client; truth and transition rules belong in the ledger. Preserve historical facts, decisions, and seals. Reuse W-005's document-versioning and distribution work after checking what has already shipped. Revalidate historical findings before creating fixes.

This proposal needs no new task hierarchy, generic workflow engine, event store, agent runtime, SaaS platform, or automatic architecture extraction. The local backlog and session are projections. Deferred commitments extend decisions; `related` supplies their discovery. Add only the permission and evidence contracts needed for explicit guarantees.

Implementation uses the library-consumer trust profile and portable CLI choice recorded below. Existing seal policy, including TN-002, requires an explicit revision to admit delegated execution; this draft does not silently change it.

## Implementation decisions

- Preserve the existing library-consumer quality bar: correctness-sensitive verification and permission boundaries; unit, integration, and consumer evidence. No new performance SLO or production deployment is implied.
- Deliver the six indexed verticals independently, starting with AC-05. The first vertical changes aggregation only; read-side effects and evidence freshness follow separately.
- AC-05 aggregates every binding, with fail before missing/unbound before attested before pass. Duplicate result keys are errors even if the duplicate outcomes agree. Bindings without an executable locator remain missing.
- Portable CLI remains available. The user subsequently selected the local Spec Ledger UI host for direct approval: a same-origin, token-protected endpoint accepts only typed approve/deny operations for the observed spec revision and permission-state digest, bounds request size, rejects stale state, and makes retries idempotent. It invokes the shared permission writer, never arbitrary shell text. The projection server remains read-only. Local browser records do not authenticate a human identity. Poll every five seconds; show failed observations as disconnected.
- Historical records remain immutable. New authority is agent-reported unless a future trusted host supplies it; local files are not authentication against a malicious writer. Commands execute only on explicit CLI check operations; reads never execute bindings.

### Security boundary

The local CLI caller and checkout owner are trusted to authorize writes and explicit command execution. Ledger text, command output, artifact references, external task descriptions, and HTTP inputs are untrusted data. The ledger does not authenticate a hostile filesystem owner or prove an agent-reported instruction came from a human. Core eligibility checks enforce explicit scope, denial, and revocation; UI cannot upgrade provenance. Read-only HTTP and client operations execute no binding commands and persist no state. Local artifact access rejects traversal, absolute escapes, and symlink escapes from the checkout; hashes cover retained bytes. Negative integration tests exercise these boundaries before shipping their slices.

## User-requested UI refinement

The local host shows approved status without repeated approval prompts, uses Nessa UI menu controls for session selection, and removes the duplicate Specs and history overview. Dedicated navigation retains specs and history. Current product labels use Spec Ledger UI; historical ledger identifiers and records remain intact, with friendly public route aliases. This amendment follows user screenshots of the current UI and their explicit request for direct approval.
