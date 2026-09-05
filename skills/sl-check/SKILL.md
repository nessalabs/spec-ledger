---
name: sl-check
description: Execute Spec Ledger checks, review current evidence and deferred obligations, and close or complete authorized work honestly.
---

# Check

Use `spec-ledger check` to explicitly run configured commands and persist stamped results. Observing session, context, client, or server data never runs checks. For external runners use [evidence](../../docs/architecture/evidence.md); do not restamp old results as current.

Inspect each acceptance criterion in `spec-ledger session --workstream W-NNN`. Keep implemented, verified, and complete distinct. Missing mappings, path-only evidence, stale results, and attestations cannot become a verified behavior by narrative assertion.

Read `get_workflow` for the selected verification and review steps. Follow their preserved guidance, attach existing typed results to the current attempt with `record_workflow_output`, and inspect the computed blockers. An attestation only satisfies an explicitly attested output; it never substitutes for a passing check or required independent review.

Resolve required independent review findings ([sl-dev-break](../sl-dev-break/SKILL.md) by default), obtain applicable [sl-dev-align](../sl-dev-align/SKILL.md) coverage, and use [sl-dev-verify](../sl-dev-verify/SKILL.md) to close the turn. A new source change requires current evidence/review again.

Only mark the workstream done through `spec-ledger complete --workstream W-NNN`; it checks acceptance, permission, required reviews, affected deferred obligations, and the selected method's required outputs. Failure is actionable unfinished work, not permission to edit gate records or relax acceptance. Keep the user informed of concrete missing evidence.
