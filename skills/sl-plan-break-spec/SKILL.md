---
name: sl-plan-break-spec
description: >-
  Adversarial / devil’s-advocate review of a shaped Spec Ledger workstream
  before seal: use `spec-ledger related` (claims, graph, prior turns/docs,
  optional worktree cautions) — not vibe-only gaps. Use after sl-plan-shape, or
  when the user says break the spec, spec review, devil’s advocate, or find gaps.
---

# sl-plan-break-spec

Attack the **written** bet so we build the right thing. Ground the attack in a
**tool-built related-spec pack** — do not hand-roll `git worktree list` or
re-walk the graph yourself.

Contract: [`docs/architecture/work-model.md`](../../docs/architecture/work-model.md)
§3.2 / §9.2. Structure: [`../references/cheap-to-change.md`](../references/cheap-to-change.md)
(+ `system-architect` when installed). Code falsification later:
[`sl-dev-break`](../sl-dev-break/SKILL.md).

## When to run

| Situation | Action |
| --- | --- |
| Workstream just reached `shaped` | Run (default if `policy.requireSpecBreak`) |
| User says break the spec / devil’s advocate / find gaps in the plan | Run |
| Still grilling / no workstream file | Wait — shape first |
| Already `sealed` and human wants re-open | Unseal explicitly; do not silent-edit `seal` |

## Hard rules

| Allowed | Forbidden |
| --- | --- |
| Findings review (`target: "spec"`) | Writing product / test code |
| Edits to workstream / proposed-claims **after human confirms** each fix | Promoting live `claims/` |
| Status → `spec_review` then await seal | Opening turns / implementing |
| Surfacing findings ≥ `alertOnSeverity` | Inventing trust/perf requirements |
| Citing `related` pack paths / cautions | DIY worktree scans or ignoring the pack when the CLI exists |
| Treating `worktree-caution` as caution only | Refusing seal solely because another worktree is dirty |

**Host:** run this skill via a **separate Task subagent**, not the shaper writing
the review in-process. Default model: **same class as parent** (`inherit`);
named models (e.g. Fable) only when the user asks — see
[`.cursor/rules/review-subagent-models.mdc`](../../.cursor/rules/review-subagent-models.mdc).

## Method

### 1. Load the bet + related pack (required)

```bash
pnpm exec spec-ledger related --workstream W-00N --worktrees --json
```

Until the CLI exists, approximate the same pack with existing
`impact` / claims / turns APIs — still prefer tool output over ad-hoc shell.

Also read: this workstream (acceptance, out-of-scope, trust, policy, verticals,
proposed claims, attachments).

The pack already includes (when implemented): related features, live/proposed
claims + bindings, blast-radius paths, prior turns/decisions, **docs/files those
episodes touched**, and optional sibling-worktree **caution** entries
(mtime-ordered related paths only).

### 2. Attack the spec (using the pack)

- Contradictions: acceptance vs out-of-scope; trust vs evidence; **proposed vs
  live claims** in the pack; this bet vs prior decisions cited in the pack
- Untestable or vague acceptance
- Verticals that are horizontal chores
- Missing negative cases / failure modes
- Claims with no path to required evidence kinds
- Hidden prod/perf/security assumptions not in `trust`
- **Dependency / other-feature misses** called out by related features + paths
- Tech-debt shaped as “one more vertical”
- **Structure smells** (cheap-to-change): widens shared core with a product
  `if`; fuses mechanism and policy; wrong-way dependency; “just add a flag”;
  acceptance that forces every feature to touch the same god module; cannot
  describe how the bet gets **deleted**
- Pack `worktrees.entries[]` → usually `moderate` caution findings (“also
  changing over there”), never auto-merge or treat as sealed

If `worktrees.scanned === false`, copy `skippedReason` into `residualRisks`.

### 3. Findings + interrupt policy

1. Emit findings with severity; cite claim / feature / path / turn ids from the pack.
   Each review needs `plainSummary` and each finding needs `plainImpact` — see
   [`../references/review-lattice-copy.md`](../references/review-lattice-copy.md).
   Keep `gap` technical.
2. Alert when `severity >= policy.alertOnSeverity`; apply `onAlert`.
3. Propose fixes; honor `block`/`wait` / timeout.
4. Re-check until alert-threshold findings clear, waive, or policy `move`.
5. Ask human to **seal** when ready:

```json
{
  "status": "sealed",
  "seal": {
    "sealedAt": "<iso>",
    "sealedBy": "<human>",
    "specDigest": "<hash of sealed body>",
    "specBreakReviewId": "W-00N/SR-01"
  }
}
```

## Review artifact

Until CLI exists, write e.g. `.spec-ledger/reviews/workstreams/W-00N/SR-01.json`
(include `id` on findings). Cite pack paths in `gap` / `evidencePath`.

## Exit summary

```
spec-break: W-00N
status: spec_review | sealed
related: features=… claims=… docs=… worktree-cautions=N|skipped
alertOnSeverity: high
onAlert: move|block|wait
alerted: N | waived: N | timed_out: N
next: human seal | shape amend | wait-timeout | sl-dev-build (only if sealed/bypass)
```

## Absences

- No code, no turns, no verify theater
- No sealing without human confirm
- No silent post-seal edits
- No inventing foreign-worktree conflicts without pack `worktree-caution` entries
- No skipping `related` when the command exists for this workstream
