# Agent notes

1. Read [DESIGN.md](DESIGN.md) and [docs/architecture/work-model.md](docs/architecture/work-model.md) before changing boundaries.
2. Skills use prefix **`sl-`** — see [skills/README.md](skills/README.md) (`sl-plan-*`, `sl-dev-*`, `sl-learn`). Keep them in this repo; optionally install `nessalabs/skills` (`system-architect`, `coding`, `method`) as companions.
3. Always honor [skills/references/cheap-to-change.md](skills/references/cheap-to-change.md) (quality bar + structure) and [skills/references/review-lattice-copy.md](skills/references/review-lattice-copy.md) when writing reviews.
4. Missing vision → [skills/sl-plan-vision](skills/sl-plan-vision/SKILL.md) before first shape (sets quality bar).
5. Ambiguous / multi-slice → [skills/sl-plan-shape](skills/sl-plan-shape/SKILL.md).
6. After shaped → [skills/sl-plan-break-spec](skills/sl-plan-break-spec/SKILL.md) → human seal.
7. Build only when **sealed** (or bypass) → [skills/sl-dev-build](skills/sl-dev-build/SKILL.md).
8. Wait timeout / no user → weigh **confirmed tenets** + vision; cite on the decision.
9. High-signal user correction → [skills/sl-learn](skills/sl-learn/SKILL.md) (≤1 ask/turn).
10. Post-seal drift → document + honor `onSealedSpecDeviation`.
11. After each vertical implements → [skills/sl-dev-break](skills/sl-dev-break/SKILL.md) **while turn open**; honor `onAlert`. Run the breaker as a **separate subagent** (see [.cursor/rules/review-subagent-models.mdc](.cursor/rules/review-subagent-models.mdc)): default **same model class as the builder** (`inherit`); named models (e.g. Fable) **only when the user asks**. Lattice copy: [skills/references/review-lattice-copy.md](skills/references/review-lattice-copy.md) (`plainSummary` / `plainImpact` required by `schemas/review.json`).
12. Path coverage before close/push when `requireAlignApprove` → [skills/sl-dev-align](skills/sl-dev-align/SKILL.md) (cheap/Haiku; **ask user for coverage intent** before approve; `--plain-summary` required).
13. End every turn with [skills/sl-dev-verify](skills/sl-dev-verify/SKILL.md) — `turn close` (refuses without contextDigest / unresolved blocking / align when required).
14. UI packages must not import `@nessa/spec-ledger` — only `@nessa/spec-ledger-client`.
15. Server is read-only (SL-003). Git is the write path. Never hand-edit turn `facts`.
16. Never put `status: pass` on a binding.

```bash
pnpm -r build && pnpm test && pnpm verify && pnpm ledger:audit && pnpm ledger:align
```
