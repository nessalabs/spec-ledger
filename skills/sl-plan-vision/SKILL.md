---
name: sl-plan-vision
description: >-
  Spec Ledger (sl-plan): at project start capture product vision and initial
  tenets with the human for decisions when the user is absent or after wait
  timeouts. Use when the user says vision, tenets, north star, sl-plan-vision,
  or when .spec-ledger/vision.json is missing.
---

# sl-plan-vision

Write the standing **vision** and a small set of **tenets** agents will weigh
when confused, on wait timeout, or in automated cycles. This is not a workstream
and not verify.

Also set the **quality bar** with the human (hobby / library / prod) — that
dials trust and how hard plan/break/build gates run. Same `sl-*` skills; no
parallel hobby tree. Structure gems:
[`references/cheap-to-change.md`](../references/cheap-to-change.md).

Contract: [`docs/architecture/work-model.md`](../../docs/architecture/work-model.md) §4.0.

## When to run

| Situation | Action |
| --- | --- |
| Greenfield / no `vision.json` | Run before first shape |
| User says set vision / tenets / north star | Run |
| Vision exists; small amend | Edit with human confirm — don’t re-grill everything |

## Hard rules

| Allowed | Forbidden |
| --- | --- |
| `.spec-ledger/vision.json` (+ optional `vision.md`) | Inventing a long fake constitution |
| `tenets/TN-*.json` with honest `origin` | Labeling agent prose as `origin: "user"` |
| Few sharp tenets (prefer ≤7 product-level) | Tenet spam; replacing claims |

## Method

1. Ask (grill frontier — recommend, then confirm):
   - One-sentence summary / north star
   - Who we optimize for
   - Product-level non-goals
   - **Quality bar:** hobby/spike · library/staging · prod (money/auth/data loss)?
     This sets default seriousness for trust/evidence later — not a separate pipeline.
   - 3–7 weighing rules (“when X vs Y, prefer…”) including at least one about
     **honesty vs green theater** and one about **cheap next change vs clever now**
     when those conflict
2. During the initial conversation, if the product is security/privacy sensitive
   or the user identifies security-intensive work, use
   [`sl-security-review`](../sl-security-review/SKILL.md) to establish assets,
   attacker capabilities, and unacceptable outcomes. Reuse answers already given;
   carry the security model into vision prose and subsequent specs.
   Write `vision.json`. Optional `vision.md` for narrative.
3. For each tenet: set `origin: "user"` if they dictated it; if you proposed and
   they agreed → `agent-confirmed` + `confirmedAt`/`confirmedBy`; never leave
   bootstrap tenets as bare `agent-inferred` without saying so.
4. Stop. Hand off to `sl-plan-shape` for the first bet — trust there must match
   the quality bar settled here.

## Templates

`.spec-ledger/vision.json`:

```json
{
  "schemaVersion": 1,
  "summary": "One-sentence north star",
  "northStar": "What good looks like",
  "nonGoals": ["…"],
  "users": ["…"],
  "updatedAt": "2026-09-02T00:00:00.000Z",
  "updatedBy": "human"
}
```

`.spec-ledger/tenets/TN-001.json`:

```json
{
  "schemaVersion": 1,
  "id": "TN-001",
  "statement": "When honesty and convenience conflict, prefer honest digests over green theater",
  "scope": "product",
  "status": "active",
  "origin": "user",
  "weight": "must",
  "confirmedAt": "2026-09-02T00:00:00.000Z",
  "confirmedBy": "human",
  "createdAt": "2026-09-02T00:00:00.000Z"
}
```

## Exit

```
vision: ok
qualityBar: hobby|library|prod
tenets: TN-001… (origins…)
next: sl-plan-shape
```
