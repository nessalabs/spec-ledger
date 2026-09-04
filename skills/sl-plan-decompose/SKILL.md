---
name: sl-plan-decompose
description: >-
  Carve a shaped bet into e2e-checkable verticals (one turn each): slice by
  independently fail-able product moments, not layers. Use from sl-plan-shape,
  or when the user asks to decompose / verticalize / slice a workstream or
  feature into suggestedSlices.
---

# sl-plan-decompose

Turn a clear objective into **`suggestedSlices`**: each slice is one turn of
isolated, stress-testable behavior with its own `acceptance[]` and `evidence[]`.

Contract SSOT: [`docs/architecture/work-model.md`](../../docs/architecture/work-model.md) §5.1.
Structure: [`../references/cheap-to-change.md`](../references/cheap-to-change.md).
Usually invoked inside [`sl-plan-shape`](../sl-plan-shape/SKILL.md); can run alone
when the bet is already clear and only the cut needs work.

Do **not** implement code, open turns, or mint live claims.

## Goal

Leave a builder a sequence where **after each closed turn** something real is
true (typed API, CLI path, Spec Ledger UI join, fixture loop)—not “schemas landed” or
“S3 client exists” with no product behavior. Prefer cuts where the **next**
change stays cheap: small surface, one owner of the information, deletable
without rewriting the core.

## Slice by moments, not layers

| Prefer | Reject |
| --- | --- |
| Product moments that fail independently | Horizontal chores (all schemas → all CLI → all UI) |
| Thin paths that still return **typed product truth** | Pure transport/bytes with no domain check as a “vertical” |
| Smallest bet that **proves the loop** the owner asked for | Catalog completeness (P1–P3 of the work model) |
| Capability composed **on top of** core | Verticals that force a feature-named branch into shared core |
| Optional slice when schema/scope is ambiguous | Inventing a third vertical “just in case” |
| One owner / one deletable module cluster | Slices that must touch every package to mean anything |

**Independently fail-able** means a later builder (or Spec Ledger UI) can be wrong in
that moment while earlier moments stay green. Example loop moments:

1. Context wrong / unsealed  
2. Open–break–close greenwashed  
3. Episode never appears on the feature  

Those are three verticals. “Write all episode schemas” is not.

## Library / IO pattern (reader-style bets)

When the ask is “schema + remote load → typed value”:

| Order | Vertical | Why |
| --- | --- | --- |
| 1 | Fixture → parse/validate/serialize typed | Proves domain without cloud flakiness |
| 2 | Same contract over object storage (fake/local S3) | Proves transport **and** typed truth together |
| 3 | Optional envelope only if product confirms a distinct shape | Skip if v1 is report-only |

Do **not** insert a middle vertical that only returns raw bytes unless the
product ships a reusable storage client as a standing feature. Isolated fetch
without the type is a layer chore dressed as a slice.

Merging 1+2 into one turn is allowed for tiny appetite—but then a fail cannot
tell schema bugs from transport bugs. Prefer split when evidence kinds differ
(`unit`/`property` vs `integration`).

## Platform bets (this repo)

If the owner asks for “agents get context + Spec Ledger UI shows evolution,” prefer
proving the **builder episode loop** before polishing the history catalog:

1. Sealed slice → `context` / `contextDigest`  
2. One workstream turn → break-while-open → close refusals  
3. Closed episode visible on feature history (client + Spec Ledger UI join)

Defer until the loop is real: vision/compass UI, automation wait/resume,
decision `basis` taxonomy, full timeline product, seal CRUD beyond fixtures.

## Acceptance discipline

Each vertical must name:

- **Given / when / then** checks a builder can run (CLI flags, HTTP method,
  client method, Spec Ledger UI route—use real paths in this repo when known)
- **`evidence[]`** matching trust (`unit`, `integration`, `e2e`, …)
- **`expectedClaimIds`** (live) and gaps as **proposed** claims only
- What is **out of scope** for that slice (not the whole bet)

Order slices by **unblock dependency** (what the next agent must call), not by
package layout.

## Anti-patterns

- “Schemas package” then “wrapper” then “UI wiring” as three turns  
- One mega-vertical that implements the entire work model  
- Acceptance that only says “tests pass” with no observable product contract  
- Slices that change `verify.ok` / `ledgerDigest` via history/compass files  
- Pre-creating `turns/` or a `tasks/` WBS during decompose

## Output shape

```
verticals:
  SLC-01 — <title>
    acceptance: […]
    evidence: […]
    expectedClaimIds: […]
  SLC-02 — …
order: why this sequence
out: deliberately deferred
appetite: hours/days guess
```

Hand back to shape (mark `shaped` only after human confirm) or to
[`sl-plan-break-spec`](../sl-plan-break-spec/SKILL.md) if the workstream is
already shaped and only slices changed.

## Related

- Cheap to change: [`../references/cheap-to-change.md`](../references/cheap-to-change.md)
- Shape / grill: [`sl-plan-shape`](../sl-plan-shape/SKILL.md)
- Builder: [`sl-dev-build`](../sl-dev-build/SKILL.md)
