---
name: sl-plan-shape
description: >-
  Grill the human into a shaped Spec Ledger workstream with trust/criticality,
  proposed claims, and e2e-checkable verticals — without opening turns or
  implementing. Use when the ask is ambiguous, multi-slice, a new bet, or the
  user says grill / shape / sl-plan-shape / plan this / don't build yet.
---

# sl-plan-shape

Interview until the bet is clear enough to build. Write **plan-plane** ledger
files only. Do **not** implement code, open turns, or mint live claims.

Contract SSOT: [`docs/architecture/work-model.md`](../../docs/architecture/work-model.md).
Method: design-tree grilling (same cadence as a grill skill).
Structure: [`references/cheap-to-change.md`](../references/cheap-to-change.md)
(and `system-architect` if installed).

Skills lower friction. **CI / audit enforce.** This skill is not a substitute
for gates.

## When to run

| Situation | Action |
| --- | --- |
| Ambiguous or multi-slice ask | Shape first |
| New feature / risky change | Shape first |
| User says grill / shape / plan this | Shape |
| Human: “skip shape / single small turn” | Skip; hand off to builder |
| No `.spec-ledger/vision.json` | Run [`sl-plan-vision`](../sl-plan-vision/SKILL.md) first |
| Workstream already `shaped`/`active` | Do not re-grill unless asked |

## Hard rules (write set)

| Allowed | Forbidden |
| --- | --- |
| `.spec-ledger/workstreams/W-*.json` | `turn open` / any turn `facts` |
| Workstream attachments (e.g. `pitch.md`) | Implementing product code |
| `.spec-ledger/proposed-claims/*.json` | Promoting into `claims/` alone |
| Graph `features[]` **only** if human confirms a net-new standing feature | Agent-authored digests / verify as “pass theater” |
| Optional theme under `themes/` | Untyped planning bags |
| Read vision/tenets when weighing the bet | Quietly minting `origin: user` tenets |

Verify ignores workstreams and proposed claims. Suggested slices are
**verticals** (acceptance + evidence kinds), not bare titles and not
pre-created turns. No `tasks/` collection.

## Interview method

Map the bet as a **design tree**. Work in **rounds**. The **frontier** is every
decision whose prerequisites are settled. Ask the whole frontier in one round;
number each question; give your recommended answer; wait.

```
❓ **Q1** - **<title>**: <body / choices>

➡️ <recommended answer>
```

- **Facts** (repo, existing features/claims): look up yourself — do not ask.
- **Decisions**: put to the human and wait.
- A question that depends on another open answer belongs in a **later** round.
- Done when the frontier is empty. Do **not** mark `shaped` or hand off until
  the human confirms shared understanding.

## Frontier the skill must settle

1. Theme / business outcome (optional standing theme)
2. Standing **feature(s)** — create in graph only with human confirm
3. Problem + restated objective
4. Appetite (time box) / changeType / risk
5. Acceptance criteria + out of scope / no-gos  
   (testable acceptance; refuse “works well” / platforms nobody asked for)
6. **Trust profile (ask — do not invent)** — align with vision quality bar:
   - Deploy target: local / staging / prod / library-consumer?
   - User-facing?
   - Performance-critical? If yes → budgets (p99, RPS, memory, …)
   - Security / privacy sensitive?
   - Correctness-critical (money, auth, data loss)?
   - Required evidence: unit / integration / e2e / property / fuzz / load
7. **Structure (short):** which feature/package owns this; does it widen core or
   compose on top; how does it get deleted; any dependency that points the wrong way?
8. Expected live claims; gaps → **proposed** claims only
9. **Verticals** — each one turn of isolated, e2e-checkable behavior with its
   own `acceptance[]` and `evidence[]`. Use
   [`sl-plan-decompose`](../sl-plan-decompose/SKILL.md) for the cut (moments,
   not layers; prove the asked loop before catalog polish).
10. Rabbit holes / probes before building
11. **Automation policy** — apply **product defaults** unless human overrides:
    - `alertOnSeverity: high`
    - `onAlert: wait` (10m) → `onAlertTimeout: move`
    - `onSealedSpecDeviation: block` if prod, else `wait` (10m → move)
    - `requireSpecBreak` / `requireCodeBreak: true`

**Exit artifact:** workstream `shaped` — then hand to
[`sl-plan-break-spec`](../sl-plan-break-spec/SKILL.md) before seal/build.

## On-disk artifacts

Prefer CLI when available. Until then, write JSON per
[workstream-template.md](workstream-template.md):

- Workstream → `.spec-ledger/workstreams/W-00N.json` (`status: shaped` after confirm)
- Proposed claim → `.spec-ledger/proposed-claims/PC-00N.json` (`status: "proposed"`)

Pick the next free `W-` / `PC-` id by listing those directories.

## Exit / handoff

1. Human confirms shared understanding.
2. Workstream status → `shaped`.
3. Summarize:

```
workstream: W-00N (shaped)
trust: deploy=… perf=… security=… correctness=… evidence=…
policy: alertOnSeverity=… onAlert=… onSealedSpecDeviation=…
featureIds: …
proposedClaimIds: …
verticals: SLC-01 … (acceptance each)
next: sl-plan-break-spec → human seal → sl-dev-build
```

4. Stop. Do not open a turn or seal in this skill.

## Absences

- No `tasks/*.json`
- No horizontal chore lists disguised as slices
- No inventing perf/load requirements the human did not affirm
- No live `claims/` writes without human/builder promote in an implementing turn

## Related

- Cheap to change: [`../references/cheap-to-change.md`](../references/cheap-to-change.md)
- Decompose verticals: [`skills/sl-plan-decompose`](../sl-plan-decompose/SKILL.md)
- Spec breaker: [`skills/sl-plan-break-spec`](../sl-plan-break-spec/SKILL.md)
- Builder: [`skills/sl-dev-build`](../sl-dev-build/SKILL.md)
- Code breaker: [`skills/sl-dev-break`](../sl-dev-break/SKILL.md)
- Close gate: [`skills/sl-dev-verify`](../sl-dev-verify/SKILL.md)
