---
name: sl-work
description: Implement an authorized Spec Ledger workstream while recording meaningful progress, deviations, and deferred commitments.
---

# Work

Start with `spec-ledger work --workstream W-NNN --slice SLC-NN --goal 'User-visible outcome'`. The writer checks permission, prepares an executable spec snapshot, activates applicable deferrals, and stamps context. Then read `spec-ledger context --workstream W-NNN --slice SLC-NN --json` and [cheap-to-change](../references/cheap-to-change.md).

Record user-relevant behavior and decisions rather than tool chatter. Use `spec-ledger progress --file ...` for implementation updates and optional previews; see [session](../../docs/architecture/session.md). Progress is agent-reported, not proof. Use `spec-ledger defer --file ...` for conditional commitments; see [deferrals](../../docs/architecture/deferrals.md).

For bugs reported during work, use [issue intake](../../docs/architecture/issue-intake.md): repair code defects against existing intent; amend specs for missing or conflicting intent. Link observation, cause when known, and regression evidence. Use [sl-learn](../sl-learn/SKILL.md) for supported corrections without promoting a single incident into a global rule.

After each vertical, run the separate [sl-dev-break](../sl-dev-break/SKILL.md) reviewer while the turn is open, then [sl-check](../sl-check/SKILL.md). Honor permission limits and deviation policy at each meaningful scope change.
