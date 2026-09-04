---
name: sl-plan
description: Plan a Spec Ledger feature against existing specs, corrections, backlog candidates, and deferred commitments before implementation.
---

# Plan

Read the user's request and applicable vision, then use `spec-ledger plan --workstream W-NNN`. Inspect related specs and unresolved deferrals even when their originating turns are old. Feature links are deterministic retrieval hints; also research semantic interactions and record missing links. Local backlog candidates are optional suggestions; activated commitments have explicit completion gates. External discovery marked not-configured is not evidence of an empty external backlog.

For missing vision use [sl-plan-vision](../sl-plan-vision/SKILL.md); for ambiguous or multiple slices use [sl-plan-shape](../sl-plan-shape/SKILL.md). Preserve [cheap-to-change](../references/cheap-to-change.md). Run [sl-plan-break-spec](../sl-plan-break-spec/SKILL.md) for required independent review.

Honor the user's chosen revision approval, request delegation, or standing delegation. Use [permission](../../docs/architecture/permission.md); never infer new authority from elapsed time. Existing authorization need not be asked again. Record source provenance honestly and keep a reviewable spec snapshot even under delegated execution.

Before building, use [sl-work](../sl-work/SKILL.md).
