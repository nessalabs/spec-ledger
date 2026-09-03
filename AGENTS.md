# Agent notes

1. Read [DESIGN.md](DESIGN.md) and [docs/architecture/work-model.md](docs/architecture/work-model.md) before changing boundaries.
2. Skills use prefix **`sl-`** — see [skills/README.md](skills/README.md) (`sl-plan-*`, `sl-dev-*`, `sl-learn`). Keep them in this repo; optionally install `nessalabs/skills` (`system-architect`, `coding`, `method`) as companions.
3. Always honor [skills/references/cheap-to-change.md](skills/references/cheap-to-change.md) (quality bar + structure).
4. Missing vision → [skills/sl-plan-vision](skills/sl-plan-vision/SKILL.md) before first shape (sets quality bar).
5. Ambiguous / multi-slice → [skills/sl-plan-shape](skills/sl-plan-shape/SKILL.md).
6. After shaped → [skills/sl-plan-break-spec](skills/sl-plan-break-spec/SKILL.md) → human seal.
7. Build only when **sealed** (or bypass) → [skills/sl-dev-build](skills/sl-dev-build/SKILL.md).
8. Wait timeout / no user → weigh **confirmed tenets** + vision; cite on the decision.
9. High-signal user correction → [skills/sl-learn](skills/sl-learn/SKILL.md) (≤1 ask/turn).
10. Post-seal drift → document + honor `onSealedSpecDeviation`.
11. After each vertical implements → [skills/sl-dev-break](skills/sl-dev-break/SKILL.md) **while turn open**; honor `onAlert`.
12. End every turn with [skills/sl-dev-verify](skills/sl-dev-verify/SKILL.md) — `turn close` (refuses without contextDigest / unresolved blocking).
13. UI packages must not import `@nessa/spec-ledger` — only `@nessa/spec-ledger-client`.
14. Server is read-only (SL-003). Git is the write path. Never hand-edit turn `facts`.

```bash
pnpm -r build && pnpm test && pnpm verify
```
