---
id: "sl-verification"
title: "Verify this atlas"
kind: "guide"
status: "implemented"
summary: "This atlas maps current source and uses selected finite models to challenge specific rules. Models do not execute TypeScript, authenticate users, or qualify a deployed service."
parent: "sl"
sources: ["package.json", "packages/ledger/src/cli/main.ts"]
sourceRevision: "651b9a59a83ffd4d83e4f18767e240d120c155fa"
diagramLinks: {}
---

# Inspect this atlas’s evidence

This atlas maps current source and uses selected finite models to challenge specific rules. Models do not execute TypeScript, authenticate users, or qualify a deployed service.

The source checkpoint is the reviewed base revision; ledger records created for this documentation task are new work history, not a substitute source checkpoint. The repository build and 353 existing tests passed on arm64 macOS: 265 ledger, 15 MCP, 73 UI helpers. These counts do not include a full reference-UI build or human usability study.

The catalog check passed for 20 pages. All three finite models passed across 39 distinct states. Seven negative controls each broke the expected rule. An independent reviewer repeated these runs in an isolated copy, checked six reader tasks using only the docs, then checked the explanations against source. No material misunderstanding remained in that sample. A malformed-catalog probe also confirmed that the runner refuses duplicate document IDs before replacing its evidence file.

The browser check opened all 20 pages and rendered three diagrams without page or diagram errors. This checks the atlas, not the product's reference UI. Reader tasks and source review are simulated review evidence, not a human usability study or proof of every branch.

To repeat the checks, install the workspace dependencies, then run:

```sh
pnpm -r build
pnpm test
pnpm verify
pnpm ledger:audit
pnpm ledger:align
NESSA_DOCS_ROOT=/absolute/path/to/nessa-docs node scripts/state-docs/verify.mjs
```

The last command needs a built Nessa Docs checkout and its installed checker. Add `--write` only when intentionally replacing model receipts. The committed control definitions and results are in `verification/state-models/`. The independent review record and final ledger gate results belong to this change's review history; consult the PR for their final outcome.

`pnpm verify` executes the configured checks and writes evidence. The initial run passed all 35 configured claims; audit and alignment also passed. A later source edit can make that evidence stale. A passing claim projection does not mark the documentation workstream complete: its acceptance criteria do not invent new live claims merely to obtain a green completion badge. The turn history records the final reviewed tree separately.
