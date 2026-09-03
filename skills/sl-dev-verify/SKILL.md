---
name: sl-dev-verify
description: >-
  Spec Ledger (sl-dev): close the open turn after sl-dev-break (unless waived),
  stamp facts/digests, refuse close if blocking reviews or missing context.
  Use at end of every implementing turn.
---

# sl-dev-verify

Skills lower friction. **CI enforces.**

Prefer the full loop from [`sl-dev-build`](../sl-dev-build/SKILL.md): context →
open → implement → [`sl-dev-break`](../sl-dev-break/SKILL.md) → **this skill**.

## Turns

| Who | Writes |
| --- | --- |
| You | `intent`, decisions/sources, tests, adversarial review (while open) |
| `turn open` (tool) | `opened.*` including `contextDigest` when `--workstream` |
| `turn close` (tool) | `facts` — never hand-edit |

## Required end-of-turn

1. Ensure code-break ran (or typed waiver) while turn was open.
   Accept only `request-changes` (then resolved) or `approve` with non-empty
   `killersCited` and run `evidence` on findings — not bare paths, not `comment`.
   Reviews must include Lattice copy (`plainSummary` / finding `plainImpact`) —
   [`../references/review-lattice-copy.md`](../references/review-lattice-copy.md).
2. Clear blocking findings via a resolving review (`resolvesReviewId` /
   `resolvesFindingIds`) — do not mutate the original adversarial review.
   Builder fixes **prod** only; do not rewrite breaker killers to go green.
3. Close:

```bash
pnpm exec spec-ledger turn close [--id T-00N] [--slice SLC-01]
```

Close **refuses** if: missing `opened.contextDigest` on a workstream turn,
`requireCodeBreak` unmet, unresolved blocking reviews, or `blocked` automation
events. Exit code must be `0`.

4. If not using turns yet:

```bash
pnpm test && pnpm verify
```

## Commit messages

While the turn is open, every commit (especially the closing one) should carry
trailers so git navigation joins back to the ledger — see
[`episodes.md` Provenance chain](../../docs/architecture/episodes.md):

```
SL-Turn: T-00N
SL-Workstream: W-001   # when applicable
SL-Slice: SLC-01
SL-Features: turns,lattice
SL-Claims: SL-005
```

**Enforced locally:** `pnpm hooks:install` then `commit-msg` refuses commits
without `SL-Turn: <open-id>` while a turn is `open`. `pre-commit`
checks staged ledger JSON shape.

Subject line stays normal prose. Do not put raw commit SHAs into docs; the turn
id is the durable join. `facts.headCommit` is best-effort and may go missing
after rebase without failing `verify.ok`.

When a review finding changes the design, record a decision with
`addressesFindingIds` (and optional review `messages[]`) so Lattice can show
finding → choice → files.
## Exit

```bash
pnpm exec spec-ledger verify --root .
```

5. Paste into the summary:

```
spec-ledger: OK|FAIL
turn: T-00N | (none)
workstream: W-00N | (none)
contextDigest: <hex or none>
ledgerDigest: <full hex>
resultsDigest: <full hex>
commit: <git rev-parse HEAD>
```

6. Graph updates in the **same** change when structure changed.
7. Never put `status: pass` on a binding. Never hand-edit `facts` or `opened`.

## Absences

- No HTTP write routes on the server
- UI imports client only
- No treating workstream/compass presence as verify success
- No `turn reopen` — new turn only
