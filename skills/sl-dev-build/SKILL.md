---
name: sl-dev-build
description: >-
  Spec Ledger (sl-dev): execute one sealed vertical — load context, open turn,
  implement with tests, run sl-dev-break while open, then close/verify. Use when
  the user says build, implement the workstream, pick up W-…, or after
  sl-plan-shape / seal hands off.
---

# sl-dev-build

Execute a **sealed** bet one **vertical** at a time. Prefer the next
`suggestedSlices` entry with `kind: "vertical"`.

Contract: [`docs/architecture/work-model.md`](../../docs/architecture/work-model.md).  
Episodes: [`docs/architecture/episodes.md`](../../docs/architecture/episodes.md).  
Structure: [`../references/cheap-to-change.md`](../references/cheap-to-change.md)
(+ `system-architect` / `coding` from nessalabs/skills when installed).  
Break while open: [`sl-dev-break`](../sl-dev-break/SKILL.md).  
Close: [`sl-dev-verify`](../sl-dev-verify/SKILL.md).  
Corrections: [`sl-learn`](../sl-learn/SKILL.md).

## Preconditions

1. An executable spec snapshot and applicable revision approval or delegation. `spec-ledger work` prepares the snapshot under existing authority; see [permission](../../docs/architecture/permission.md).
2. **`spec-ledger context`** / `turn open --workstream` stamps `opened.contextDigest`
   (tool-only). Do not skip.
3. If still `shaped` / `spec_review` → [`sl-plan-break-spec`](../sl-plan-break-spec/SKILL.md) + seal.
4. If missing / `draft` → [`sl-plan-shape`](../sl-plan-shape/SKILL.md).
5. Read context: vision, tenets, seal snapshot, claims, prior decisions, predicted blast radius, open automation events.

## Write set

| Allowed | Forbidden |
| --- | --- |
| `turn open` / `close` / `abandon` with workstreamId + featureIds | Editing another agent’s open turn `facts` |
| **Production** code + your own non-adversarial tests; graph updates | Opening turns during shaping; coding without context |
| decisions/sources/probes/flows/attachments on **this** turn | Untyped metadata bags; Flow as proof |
| Promote proposed → live claims + bindings | Hand-editing digests |
| Mark slice `doneTurnId` on close | Claiming done without break (unless waived) + close + verify |
| Fixing prod so breaker killers pass for the **intended** reason | Editing / weakening / deleting **breaker-owned** killer tests (oracle negotiation) |

After [`sl-dev-break`](../sl-dev-break/SKILL.md): breaker owns killers until they
fail for the intended reason; you own prod only. Do not “fix” the failing test.

## Before / while implementing

Honor sealed acceptance and
[`cheap-to-change`](../references/cheap-to-change.md). Before non-trivial code:

1. Who owns the information for this decision?
2. Invariant + enforcer?
3. Crash halfway / run twice / race?
4. How does this get deleted?
5. Widening **core**, or composing on top?

Then: smallest change that makes acceptance true; match neighboring style; one
reason per commit with `SL-Turn:` while open. Prefer recording non-obvious
boundary choices as turn `decision`s (not only chat).

## Loop

```
context --workstream W --slice SLC
    → turn open …
    → implement + tests
    → wait timeout / no user? → weigh tenets → decision.basis + AutomationEvent
    → high-signal correction? → sl-learn (≤1 ask)
    → sealed-spec drift? → decision.basis + postSealAmends + interrupt mode
    → sl-dev-break (turn still OPEN)
    → fix → turn close → verify
    → next vertical
```

### Open

Before `--prompt` / `intent.userPrompt` (and any `userPromptRef` body): apply
**Intent.userPrompt hygiene** in
[`episodes.md`](../../docs/architecture/episodes.md) — fix spelling, make the
ask cohesive, **do not change meaning**, redact secrets/PII, strip abusive
language. Never write raw chat dumps or credentials into the turn.

```bash
pnpm exec spec-ledger context --workstream W-001 --slice SLC-01 --json
pnpm exec spec-ledger turn open \
  --workstream W-001 \
  --feature <id> \
  --goal "…" \
  --prompt "…" \
  [--slice SLC-01]
```

Until flags exist, set `intent.workstreamId`, `featureIds`, `sliceId`,
`restatedGoal` on the turn file **before** closing. Never hand-edit `facts`.

`restatedGoal` is the Spec Ledger UI list title — write it as a short human outcome
([`../references/plain-titles.md`](../references/plain-titles.md)),
not a slice id or file path.

**Before → after** on a turn is turn-scoped (`flows/` or `intent.flows`), never the
workstream `problem`/`objective`. When this slice changes a user-visible story,
add a flow for **this** turn (`spec-ledger flow add` or episode JSON) with a
before and after that describe only what this turn moved. Skip the chart if
there is nothing honest to say — Spec Ledger UI must not invent a shared workstream
diagram on every turn.

First turn on a workstream: set status → `active` if still `sealed`.

### Promote a proposed claim (when this slice needs it)

1. Human/builder confirms the statement.
2. Write `.spec-ledger/claims/<live-id>.json` + binding(s).
3. Reference the live id from the turn intent / decisions.
4. Remove or mark the `proposed-claims/` stub consumed.

### Close

After **sl-dev-break** (unless waived), follow [`sl-dev-verify`](../sl-dev-verify/SKILL.md).
Commits during the turn should carry `SL-Turn:` trailers (see
[provenance chain](../../docs/architecture/episodes.md)).

```bash
pnpm exec spec-ledger turn close [--id T-00N] [--slice SLC-01]
```

### Finish the workstream

When acceptance is met, run `spec-ledger complete --workstream W-NNN`.
Do not set `status` directly: completion also checks current evidence, permission,
required reviews, and affected deferred commitments.

## Absences

- No `tasks/` files — the vertical/turn is the task
- Workstreams / proposals / compass never affect `verify.ok`
- Do not treat Spec Ledger UI or Flow as proof
- Server stays read-only; git is the write path
