# Spec↔code coupling + honest Lattice trail

**Workstream:** `W-004` · **Status:** ready for human seal  
**Agent metadata:** `.spec-ledger/workstreams/W-004.json` (`specPath` → this file)  
**Spec break:** `.spec-ledger/reviews/workstreams/W-004/SR-01.json` · `SR-02.json`

> Human docs live under **`docs/workstreams/`** with a **title slug**.  
> `.spec-ledger/` keeps JSON ids, policy, slices, digests only.

---

## Problem

Agents ship UI and product changes without a sealed bet or open turn (TN-002 in spirit). Lattice then shows file dumps and bare node ids instead of the **plan**. Verify shows cryptic `SL-00N` badges. Nothing flags product paths that aren’t covered by the sealed spec, and nothing requires an align-approve artifact before push/PR/CI — silence acts like a skip.

## Objective

1. **Lattice for humans** — plan-first turns, dense lists, `specLedger` wordmark, architecture touch with workstream + features, Verify with covered totals and **statement-first** rows.
2. **Spec↔code coupling** — product paths must map to sealed plan/graph (or an **explicit** waiver). A **cheap (Haiku-class) align agent** writes approve JSON bound to `treeDigest` after asking the user for coverage intent.
3. **Gates** — `turn close`, pre-push/pre-PR, and `pnpm ledger:align` in CI fail without approve or waiver. **`verify.ok` stays claims-only.**

## Human vs agent surfaces

| Audience | Artifact |
| --- | --- |
| **You (review / seal)** | **`docs/workstreams/…` Markdown** (title slug) |
| **Agents / CI** | `.spec-ledger/**` JSON — always via `specPath` back to docs |

Long prose does **not** live in `.spec-ledger`. Seal digests this file via `specPath` / attachment digests.

**Naming:** `docs/workstreams/<title-slug>.md` — not `W-004.md` and not under `.spec-ledger/`.

## Trust

- Deploy: library-consumer · User-facing: yes · Perf: no · Security: no  
- **Correctness: yes** (false greens / silent unspecced work)  
- Evidence: unit + integration + e2e  

## Policy (defaults)

- `requireSpecBreak` / `requireCodeBreak`: true  
- `requireAlignApprove`: true · reviewer prefix `agent:align` (≠ turn producer)  
- Explicit skip allowed: waiver with **≥40 char reason**, actor, `treeDigest`, max **1** per turn  
- Alert: high → wait 10m → move  

## Out of scope

- Running LLMs inside `@nessalabs/spec-ledger` core  
- Align affecting `verify.ok` / `ledgerDigest`  
- Write/mutate Lattice forms · media player · agent auto-seal · foreign worktree auto-merge  
- Line-by-line “is this prose justified?” beyond **path coverage**  

## Verticals

### SLC-01 — Lattice: plan-first UX + brand + human Verify

**Paths:** `packages/ui/**`, `package.json`

- Wordmark **`specLedger`** (bold `spec`, regular `Ledger`); no `Bets → turns → claims` under brand  
- Turn page: **plan (from Markdown/`specPath`) → before/after → commit → docs → trail → FileDiffCard → collapsed architecture**  
- Architecture touch: workstream + **named** features (+ claim count)  
- Verify: covered totals + statement-first verdict rows  
- Dense index rows; ignore `.next` / `node_modules` in file impact  
- Absorbs current uncommitted UI polish **only after seal + turn open**

### SLC-02 — Align check (path coverage)

**Paths:** `packages/ledger/src/align/**`, audit/cli as needed, `schemas/workstream.json`

- `spec-ledger align check` (and/or audit) reports uncovered product paths  
- Covered if path matches graph `node.locator` under turn `featureIds` **or** slice `expectedPaths[]`  
- `.spec-ledger/**` + ignore globs exempt · unit tests for mapper  

### SLC-03 — Align approve + waiver JSON

**Paths:** `schemas/review.json`, `schemas/align-waiver.json`, reviews/align CLI, `skills/sl-dev-align/**`, `AGENTS.md`

- Approve carries `treeDigest`, `coverageSource`, `uncoveredPaths` (empty) or `waiverIds`  
- Waiver: reason / actor / digest / workstream|turn · refuse self-approve  
- Skill: **cheap model**; **ask user** for coverage intent before approve  

### SLC-04 — Gates

**Paths:** turns close, `scripts/git-hooks/**`, `package.json` (`ledger:align`), CI docs/workflows

- Close enforces align when policy says so  
- pre-push (+ documented pre-PR) + CI `pnpm ledger:align`  
- `pnpm verify` remains separate and claims-pure  

## Proposed claims

- **PC-013** → SL-009: product paths covered by sealed plan/graph or explicit waiver  
- **PC-014** → SL-010: requireAlignApprove gate (structured approve or waiver); not part of `verify.ok`  

## Residual risks

- Orphan UI diff under done W-003 must land only under an open W-004 turn after seal  
- Worktree scan is caution-only  
- Schema fields for align exist; runtime ships in SLC-02…04  

## Seal checklist (human)

- [ ] This Markdown matches what you want built  
- [ ] Verticals / out-of-scope / skip rules OK  
- [ ] Then: `node packages/ledger/dist/cli/main.js workstream seal W-004 --by <you>`

## Modifications

| When | Link | Summary |
| --- | --- | --- |
| 2026-09-04 | T-022 | npm package scope in prose: @nessa → @nessalabs |
