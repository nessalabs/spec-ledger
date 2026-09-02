# Agent notes

1. Read [DESIGN.md](DESIGN.md) before changing boundaries.
2. End every turn with [skills/verify-before-done](skills/verify-before-done/SKILL.md).
3. UI packages must not import `@nessa/spec-ledger` — only `@nessa/spec-ledger-client`.
4. Server is read-only (SL-003). Git is the write path.
5. Never put `status: pass` on a binding.

```bash
pnpm -r build && pnpm test && pnpm verify
```
