# Builder episode loop

**Workstream:** `W-001` · **Status:** done (retrofit pitch — prose extracted from metadata for human navigation)  
**Agent metadata:** [`.spec-ledger/workstreams/W-001.json`](../../.spec-ledger/workstreams/W-001.json)  
**Note:** Historical seal digests predate this Markdown; `specPath` is a live pointer only.

---

## Problem

`turn open` did not load a sealed slice or stamp `contextDigest`. Builders started from chat memory. Close could not refuse a missing code-break.

## Objective

Sealed slice → typed `VerticalContext` (stable digest) → turn open stamps it → close can refuse without code-break → closed episode visible on existing Lattice feature/turn pages.

## Trust & policy

- Deploy: library-consumer · User-facing · Correctness-critical  
- Evidence: unit, integration, e2e  
- Require spec-break + code-break · alert high → wait 10m → move  

## Acceptance

- Workstream seal + check-seal with immutable `seals/1.json`
- `spec-ledger context` and `getVerticalContext` share `contextDigest`
- `turn open --workstream` stamps `opened.contextDigest`; unsealed open refused
- `turn close` can refuse missing code-break for workstream turns
- Closed workstream turn visible on existing Lattice feature/turn pages
- Workstream/context files do not change verify `ledgerDigest`

## Out of scope

Compass UI · timeline routes · server `/context` · automation wait/resume · decisions/ side collection · `related --worktrees`

## Verticals

### SLC-01 — Sealed slice → typed context

- Workstream init/seal/check-seal roundtrip  
- CLI context ≡ `getVerticalContext` `contextDigest`  
- Verify `ledgerDigest` unchanged when workstreams/vision present  

### SLC-02 — Open → break-while-open → close refusals

- Unsealed open refused · open stamps `contextDigest`  
- Close without code-break review refused when `requireCodeBreak`  

### SLC-03 — Closed episode on existing Lattice pages

- `/features/turns` and `/turns/[id]` show `workstreamId` + `contextDigest`
