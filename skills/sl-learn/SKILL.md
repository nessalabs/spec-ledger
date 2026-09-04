---
name: sl-learn
description: >-
  When a user corrects the agent or reveals a wrong assumption about what
  matters, capture a Spec Ledger learning and optionally promote a tenet — with
  provenance and without spam. Use on high-signal corrections mid-turn, after
  priority bugs, or when the user says capture learning / add tenet.
---

# sl-learn

Capture **high-signal** misses so future automated decisions weigh better.
Prefer a **learning** first; promote to a **tenet** only when it should guide
timeouts / no-user choices.

Contract: [`docs/architecture/work-model.md`](../../docs/architecture/work-model.md) §4.0 · §3.5.

## High signal vs skip

| Capture | Skip |
| --- | --- |
| “We care about honesty of digests more than pretty green” | Typo / rename / one-off taste |
| Wrong assumption about who the user is | Already covered by an active tenet |
| Recurring “never do X” | Local bug fix with no priority insight |
| Judgment bug after shipping (“we thought perf mattered; it doesn’t”) | Every nit in a review |

**Budget:** ≤1 confirm-ask per turn unless the human invites more.

## Method

1. Restate the correction in one sentence (what we got wrong).
2. Check existing tenets/learnings — link or skip if duplicate.
3. Draft a **learning** (`kind`: correction | wrong-assumption | priority | judgment-bug).
4. If it should weigh future auto decisions, ask once:

```
❓ Promote to standing tenet?
➡️ Yes as TN-00N: “…” (origin agent-confirmed) | Keep as learning only | Skip
```

5. Write files with honest provenance:
   - Human dictated wording → `origin: "user"`
   - You proposed, they agreed → `agent-confirmed` + confirm fields
   - You wrote, they didn’t confirm → `agent-inferred` only (soft weight)
6. Cite `learning:LN-…` / `tenet:TN-…` on the turn’s decision/sources when it
   affected the work.
7. Do not over-ask. If they say skip, record nothing or learning-only if useful.

## Templates

`.spec-ledger/learnings/LN-001.json`:

```json
{
  "schemaVersion": 1,
  "id": "LN-001",
  "statement": "Users value honest unknown-over-stale-pass more than a green badge",
  "kind": "wrong-assumption",
  "scope": "product",
  "status": "active",
  "origin": "agent-confirmed",
  "turnId": "T-00N",
  "evidence": "User corrected: don’t show pass when digest mismatches",
  "createdAt": "2026-09-02T00:00:00.000Z",
  "confirmedAt": "2026-09-02T00:00:00.000Z",
  "confirmedBy": "human"
}
```

On promote: set learning `status: "promoted"`, `promotedTenetId`, write tenet
with `sourceLearningId` / `sourceTurnId`.

## Absences

- Not for subagent review dumps
- Not a claims substitute
- Never `origin: "user"` unless they actually authored/confirmed that way

## Issues reported during implementation

Accept a bug report in the active conversation. Reuse the relevant workstream unless the fix needs independent scope. Record a source and a decision with optional `discovery` classification (`code-defect`, `spec-gap`, `spec-conflict`, `verification-gap`, or `workflow-gap`), observation, how it was found, known cause, and regression check. Fix a code defect against existing intent. Amend the spec only when intent is missing, wrong, or contradictory; cite the discovery decision in the amendment. Never amend acceptance merely to bless broken code.

Use repeated causes as learning candidates, not automatic global tenets. The implemented portable API is `learning record --file <json>` with `source.kind: user-reported|agent-inferred`, explicit source reference, optional workstream/feature scope, and optional superseded IDs. Inferred entries remain outside active context until the user confirms a superseding correction. See `docs/architecture/issue-intake.md` and `docs/architecture/permission.md`.
