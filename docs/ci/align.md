# Align gate (CI / pre-PR)

Path coverage is **separate from** `pnpm verify` (claims-only).

## Local

```bash
pnpm -r build
pnpm ledger:align          # → spec-ledger align check
```

With an open turn that has product file changes and
`policy.requireAlignApprove`:

1. `pnpm ledger:align` — must report no uncovered product paths (or you will waiver).
2. Ask for coverage intent ([`skills/sl-dev-align`](../../skills/sl-dev-align/SKILL.md)).
3. `node packages/ledger/dist/cli/main.js align approve --turn T-… --reviewer agent:align --plain-summary "…"`
4. Or explicit: `align waiver --reason '…≥40 chars…' --actor human --turn T-…`

## Pre-push / pre-PR

`scripts/git-hooks/pre-push` runs `align check` when the CLI is built.
Install hooks: `pnpm run hooks:install` (also chmod `pre-push`).

Before opening a PR, run the same command CI runs:

```bash
pnpm ledger:align
```

## CI

GitHub Actions job step `pnpm ledger:align` runs after tests and **after**
`pnpm verify`, as its own step — failures here do not rewrite claim digests.
