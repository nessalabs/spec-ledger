---
name: sl-dev-align
description: >-
  Spec Ledger (sl-dev): cheap/Haiku-class path-coverage align check + approve.
  Establish user coverage intent before writing align approve JSON. Use before
  turn close / push when policy.requireAlignApprove. Triggers: align, coverage,
  sl-dev-align, path covered.
---

# sl-dev-align

Path coverage only — not semantic line justification. Prefer a **cheap /
Haiku-class** model. Does **not** affect `verify.ok`.

## When to run

| Situation | Action |
| --- | --- |
| Open turn with product file changes; `requireAlignApprove` | `align check` → ask user → `align approve` or waiver |
| User says coverage intent ("UI only", "ledger CLI", etc.) | Map intent to featureIds / expectedPaths; approve if check OK |
| Uncovered product paths | Do **not** approve; ask user to extend slice `expectedPaths`, shrink diff, or write an explicit waiver |

## Hard rules

1. Establish the user's coverage intent before writing approve JSON. An explicit request or accepted scope already in the conversation satisfies this; ask only when the intended coverage is missing or ambiguous. Do not invent why paths are in-scope.
2. Run `spec-ledger align check --turn T-…` (or `pnpm ledger:align`).
3. Approve only when `uncoveredPaths` is empty **or** `waiverIds` references a written waiver.
4. Reviewer must start with `policy.alignReviewerPrefix` (default `agent:align`) and must **not** equal turn `opened.producedBy`.
5. Stamp `treeDigest`, `coverageSource`, `uncoveredPaths`, and **`plainSummary`**
   on the review (schema + CLI `align approve --plain-summary`).
6. Explicit skip = `align waiver --reason …` (≥ `alignWaiverMinReasonChars`); silence is not skip.

## Commands

```bash
pnpm ledger:align
# or
node packages/ledger/dist/cli/main.js align check --turn T-016
node packages/ledger/dist/cli/main.js align approve --turn T-016 --reviewer agent:align \
  --plain-summary "Product files in this turn are covered by the sealed plan." \
  --summary "user intent: …"
node packages/ledger/dist/cli/main.js align waiver --turn T-016 --actor human \
  --reason "…… at least forty characters explaining the skip ……"
```

Spec Ledger UI copy rules:
[`../references/review-copy.md`](../references/review-copy.md).

## Stop

After approve/waiver on disk for the current `treeDigest`, continue to
[`sl-dev-break`](../sl-dev-break/SKILL.md) / [`sl-dev-verify`](../sl-dev-verify/SKILL.md).
