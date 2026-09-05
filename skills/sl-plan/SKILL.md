---
name: sl-plan
description: Plan a Spec Ledger feature against existing specs, corrections, backlog candidates, and deferred commitments before implementation.
---

# Plan

Read the user's request and applicable vision, then use `spec-ledger plan --workstream W-NNN`. Inspect related specs and unresolved deferrals even when their originating turns are old. Feature links are deterministic retrieval hints; also research semantic interactions and record missing links. Local backlog candidates are optional suggestions; activated commitments have explicit completion gates. External discovery marked not-configured is not evidence of an empty external backlog.

For missing vision use [sl-plan-vision](../sl-plan-vision/SKILL.md); for ambiguous or multiple slices use [sl-plan-shape](../sl-plan-shape/SKILL.md). Preserve [cheap-to-change](../references/cheap-to-change.md). Read the effective method through `get_workflow` (MCP or `spec-ledger operation get_workflow --file ...`). Follow its selected planning and review skills; use [sl-plan-break-spec](../sl-plan-break-spec/SKILL.md) when the default method calls for it. Required independent review remains a policy gate regardless of skill selection.

Honor the user's chosen revision approval, request delegation, or standing delegation. Use [permission](../../docs/architecture/permission.md); never infer new authority from elapsed time. Existing authorization need not be asked again. Record source provenance honestly and keep a reviewable spec snapshot even under delegated execution.

When the user chooses different skills or stages, preserve that choice through `set_workflow`; amendments need a reason and the observed snapshot digest. Do not treat chat-only choices as a stored method or silently reload changed skill text. See [engineering methods](../../docs/architecture/workflows.md) for inputs and output contracts. Before building, use [sl-work](../sl-work/SKILL.md).
