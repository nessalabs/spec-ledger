# Git hooks (Spec Ledger)

Repo-local hooks for commit trailers, staged JSON checks, and align gate.
Not Cursor agent hooks.

## Install (once per clone)

```bash
git config core.hooksPath scripts/git-hooks
chmod +x scripts/git-hooks/commit-msg scripts/git-hooks/pre-commit scripts/git-hooks/pre-push
```

Or: `pnpm run hooks:install`

## What they do

| Hook | Behavior |
| --- | --- |
| `commit-msg` | If `.spec-ledger/turns/` has a turn with `status: "open"`, the message **must** include `SL-Turn: T-00N` for that id. |
| `pre-commit` | Staged `.spec-ledger/**/*.json` / `schemas/*.json` validated against matching published schemas when `ajv` is available. |
| `pre-push` | Runs `spec-ledger align check` when CLI is built; fails on uncovered product paths. See [docs/ci/align.md](../../docs/ci/align.md). |

Contract: [docs/architecture/episodes.md](../../docs/architecture/episodes.md) (Provenance chain + query layout).
