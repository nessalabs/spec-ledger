---
name: verify-before-done
description: Before claiming work is done, run spec-ledger verify and include the report digests. Use at the end of every agent turn that changes code or ledger files.
---

# Verify before done

Skills lower friction. **CI enforces.** Do not treat this skill as a substitute for a failing gate.

## Required end-of-turn

1. From the consumer repo root (or this repo when dogfooding):

```bash
pnpm exec spec-ledger verify --root .
# or: pnpm verify
```

2. Exit code must be `0`. If not, fix claims/bindings/evidence or the code — do not edit a binding to invent `pass` (bindings have no status field).

3. Paste into the turn summary:

```
spec-ledger: OK|FAIL
ledgerDigest: <full hex from report>
resultsDigest: <full hex from report>
commit: <git rev-parse HEAD>
```

4. If you changed structure (new package, new ADR, new dependency), update `.spec-ledger/graph/codebase-graph.json` in the **same** change. Stale locators fail verify.

5. Never collapse `attested` into pass. Required claims need real evidence (`results-row`, `command`, or `path`).

## Absences

- Do not add HTTP write routes to `@nessa/spec-ledger-server`.
- Do not import `@nessa/spec-ledger` from `@nessa/spec-ledger-ui` — use the client only.
