---
name: review-lattice-copy
description: >-
  Lattice-facing review copy: one-sentence plainSummary / plainImpact.
  Use when writing any spec-break, code-break, align approve, or human review JSON.
---

# Review copy (Lattice)

Every review JSON **must** satisfy [`schemas/review.json`](../../schemas/review.json):

| Field | Who sees it | Rule |
| --- | --- | --- |
| `plainSummary` | Lattice Trail (default) | **Required.** One sentence, ≤280 chars. End behavior or takeaway. |
| `summary` | Technical notes (collapsed) | Required. Internals, test ids, paths OK. |
| `plainImpact` | Lattice finding row | **Required on every finding.** One sentence of what would happen if this stands. |
| `gap` / `fixProposal` | Technical (collapsed) | Builder-facing. |

## Do

- Write as if a product person is reading: “CI would still pass after extra files land.”
- One sentence. No lists, no function names, no file paths unless a user would say them (“the workstream page”).
- Approve reviews still need `plainSummary` (“The holes are closed; this may ship.”).

## Don’t

- Don’t paste `gap` into `plainImpact`.
- Don’t omit `plainSummary` because the CLI `--summary` exists — set `--plain-summary` too.
- Don’t invent a second paragraph. If you need more, it belongs in `summary` / `gap`.

## CLI

```bash
node packages/ledger/dist/cli/main.js review add \
  --turn T-00N --verdict request-changes|approve|comment \
  --reviewer agent:sl-dev-break \
  --summary "technical…" \
  --plain-summary "one Lattice sentence…"

node packages/ledger/dist/cli/main.js align approve --turn T-00N \
  --reviewer agent:align \
  --plain-summary "Product files in this turn are covered by the sealed plan." \
  --summary "user intent: …"
```

Hand-written JSON under `.spec-ledger/reviews/` must include the same fields.
Pre-commit validates staged review JSON for Lattice copy + code-break evidence rules.

## Review loop (host)

1. Launch breaker as a **separate Task subagent** ([review-subagent-models](../../.cursor/rules/review-subagent-models.mdc)). Default `model: "inherit"`; named models only when the user asks.
2. Breaker writes review JSON with `plainSummary` + per-finding `plainImpact` **before** returning (plus `evidence` / `killersCited` per schema).
3. Builder does **not** author the review; builder may only fix prod after `request-changes`.
4. Breaker re-runs and writes resolve/approve when green.
5. Align approve is also a review: include `plainSummary` (coverage in human language) before close when `requireAlignApprove`.
6. Lattice Trail shows `plainSummary` / `plainImpact` first; technical notes stay collapsed.
7. Gates (history plane — not `verify.ok`):
   - `writeReview` / CLI refuse without Lattice copy
   - `turn close` refuses reviews missing `plainSummary` / `plainImpact`
   - `pnpm ledger:audit` rule `reviewsNeedLatticeCopy` fails CI when any on-disk review is missing them
