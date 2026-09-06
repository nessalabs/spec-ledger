# Evidence where users review work

Status: implementation requested by the user. Custom workflows are a proposal only.

## Problem
The workstream page lists shipped turns but hides the evidence needed to judge each acceptance criterion. Old turn snapshots say outdated without explaining current coverage. Users need a single review surface, not a source-file scavenger hunt.

## Acceptance
1. Above history, show every acceptance criterion, current evidence verdict and reason, agent implementation status, and mapped claims. An unmapped criterion must show missing evidence.
2. Each claim exposes its check definition and recorded outcome separately from the current verdict; show run ID, time when attributable, source/check fingerprints, and available recorded detail. Never infer a passed check from a path or an old passing result.
3. Show linked code/spec review summaries, freshness, residual risks and workstream attachments. Local text attachments can be read inline only when confined to the checkout, bounded in size and matching their recorded digest. Missing/changed/unsupported artifacts remain explicit. Do not fetch remote artifacts.
4. Page reads remain read-only through the client. No checks execute and no records are written. Explain that history describes past snapshots. A historical Done status must not imply current evidence still passes.
5. Write a separate proposal for replaceable skills and customizable stage steps, sensible defaults, enforceable guardrails, provenance and migration. Do not implement a workflow engine in this change.

## Scope
Compose evidence into the existing session projection and workstream page. Keep the verifier authoritative. Reuse its result evaluation rather than inventing a second pass/fail algorithm. Display artifact text as escaped text, not executable content. Portable client/HTTP consumers receive the same projection.

## Verification
Independent regression tests: stale passing rows remain visibly historical, mixed/missing bindings, duplicate rows, attachment integrity and path confinement, and read-only behavior. UI typecheck and an actual browser walkthrough of the workstream evidence section. Review the workflow proposal independently for unnecessary primitives and bypasses.
