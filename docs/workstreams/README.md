# Workstream pitches (human specs)

Readable bet docs under **`docs/workstreams/`**. JSON ids/policy/seals stay in `.spec-ledger/workstreams/` and link here via `specPath`.

| Pitch | Id | Status |
| --- | --- | --- |
| [Builder episode loop](./builder-episode-loop.md) | W-001 | done |
| [P0–P3 runtime + dogfood](./p0-p3-runtime-and-dogfood.md) | W-002 | done |
| [Spec Ledger dogfood UI](./spec-ledger-dogfood-ui.md) | W-003 | done |
| [Spec↔code coupling + honest Lattice trail](./spec-code-coupling-and-honest-lattice-trail.md) | W-004 | spec_review (awaiting seal) |

**Standing compass:** [Vision](../compass/vision.md) ← `.spec-ledger/vision.json`

**Rules**

- Filename = **title slug** (not `W-004.md`)
- Prose here; metadata in `.spec-ledger/`
- New bets: write the Markdown first, then JSON with `specPath`
