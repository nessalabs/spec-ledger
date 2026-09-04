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

For security-sensitive work or relevant trust boundaries, apply the spec mode
of [`sl-security-review`](../sl-security-review/SKILL.md). Check that attacker
prerequisites, enforcing components, and denial/side-effect evidence are explicit.
Missing security acceptance is a spec gap, not proof of an exploitable defect.

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
   [`../references/review-copy.md`](../references/review-copy.md).
   Keep `gap` technical.
2. Alert when `severity >= policy.alertOnSeverity`; apply `onAlert`.
3. Propose fixes; honor `block`/`wait` / timeout.
4. Re-check until alert-threshold findings clear, waive, or policy `move`.
5. Honor the user's approval mode. In revision mode obtain approval of the current
revision; with applicable request or standing delegation, proceed within its
scope. `spec-ledger work` creates the executable snapshot after checking permission
and the current independent spec review. Never hand-write seal hashes or claim a
user signed an agent-created snapshot.

## Review artifact

Use `spec-ledger review spec --file review.json`; it stamps the current revision
and writes an immutable workstream review. Set the workstream's `specBreakReviewId`
to that record's ID. Include finding IDs and cite pack paths in `gap` / `evidencePath`.

## Exit summary

```
spec-break: W-00N
status: spec_review | sealed
related: features=… claims=… docs=… worktree-cautions=N|skipped
alertOnSeverity: high
onAlert: move|block|wait
alerted: N | waived: N | timed_out: N
next: revision approval | applicable delegation | shape amend | sl-work
```

## Absences

- No code, no turns, no verify theater
- No executable snapshot without applicable user authorization
- No silent post-seal edits
- No inventing foreign-worktree conflicts without pack `worktree-caution` entries
- No skipping `related` when the command exists for this workstream
