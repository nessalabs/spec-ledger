# Git hooks (Spec Ledger)

Repo-local hooks for commit trailers and staged JSON schema checks.
Not Cursor agent hooks.

## Install (once per clone)

```bash
git config core.hooksPath scripts/git-hooks
chmod +x scripts/git-hooks/commit-msg scripts/git-hooks/pre-commit
```

Or: `pnpm run hooks:install`

## What they do

| Hook | Behavior |
| --- | --- |
| `commit-msg` | If `.spec-ledger/turns/` has a turn with `status: "open"`, the message **must** include `SL-Turn: T-00N` for that id. |
| `pre-commit` | Staged `.spec-ledger/**/*.json` / `schemas/*.json` validated against matching published schemas when `ajv` is available. |

Contract: [docs/architecture/episodes.md](../../docs/architecture/episodes.md) (Provenance chain + query layout).
