---
name: sl-work
description: Implement an authorized Spec Ledger workstream while recording meaningful progress, deviations, and deferred commitments.
---

# Work

Start with `spec-ledger work --workstream W-NNN --slice SLC-NN --goal 'User-visible outcome'`. The writer checks permission, prepares an executable spec snapshot, activates applicable deferrals, and stamps context. Then read `spec-ledger context --workstream W-NNN --slice SLC-NN --json` and [cheap-to-change](../references/cheap-to-change.md).

Read the effective method through `get_workflow`. For an explicitly selected method, begin the eligible step with `begin_workflow_step`, follow its preserved skill instructions and link the resulting records with `record_workflow_output`. Inspect missing outputs before moving on. A reported attempt does not satisfy a step without its required current outputs; see [engineering methods](../../docs/architecture/workflows.md).

Record user-relevant behavior and decisions rather than tool chatter. Use `spec-ledger progress --file ...` for implementation updates and optional previews; see [session](../../docs/architecture/session.md). Progress is agent-reported, not proof. Use `spec-ledger defer --file ...` for conditional commitments; see [deferrals](../../docs/architecture/deferrals.md).

When the host supports activity hooks, associate this turn with its session through `register_execution` and use the persistent collector for bounded best-effort events. Read `get_execution` for in-flight observations and remaining-work guidance. Quiet time is not proof of idleness. Never treat an activity event or requested continuation policy as permission to resume or cancel; see [task activity](../../docs/architecture/execution-activity.md).

For bugs reported during work, use [issue intake](../../docs/architecture/issue-intake.md): repair code defects against existing intent; amend specs for missing or conflicting intent. Link observation, cause when known, and regression evidence. Use [sl-learn](../sl-learn/SKILL.md) for supported corrections without promoting a single incident into a global rule.

After each vertical, follow the selected review procedure while the turn is open and satisfy the applicable independence policy; [sl-dev-break](../sl-dev-break/SKILL.md) is the default procedure. Then use [sl-check](../sl-check/SKILL.md). Honor permission limits and deviation policy at each meaningful scope change.
