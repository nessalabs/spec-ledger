---
name: sl-check
description: Execute Spec Ledger checks, review current evidence and deferred obligations, and close or complete authorized work honestly.
---

# Check

Use `spec-ledger check` to explicitly run configured commands and persist stamped results. Observing session, context, client, or server data never runs checks. For external runners use [evidence](../../docs/architecture/evidence.md); do not restamp old results as current.

Inspect each acceptance criterion in `spec-ledger session --workstream W-NNN`. Keep implemented, verified, and complete distinct. Missing mappings, path-only evidence, stale results, and attestations cannot become a verified behavior by narrative assertion.

Resolve independent [sl-dev-break](../sl-dev-break/SKILL.md) findings, obtain applicable [sl-dev-align](../sl-dev-align/SKILL.md) coverage, and use [sl-dev-verify](../sl-dev-verify/SKILL.md) to close the turn. A new source change requires current evidence/review again.

Only mark the workstream done through `spec-ledger complete --workstream W-NNN`; it checks acceptance, permission, required reviews, and affected deferred obligations. Failure is actionable unfinished work, not permission to edit gate records or relax acceptance. Keep the user informed of concrete missing evidence.
