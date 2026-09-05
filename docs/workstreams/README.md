# Workstreams

Start here to find a spec. Each new workstream has one folder containing its main spec and any supporting material. Machine-readable state, formal reviews, and seals remain in `.spec-ledger/`; `specPath` identifies the main document.

## Current work

| Workstream | Main spec | Supporting material |
| --- | --- | --- |
| W-008 · Guide agents and follow verified work | [Read the spec](W-008-shared-agent-workflows/spec.md) | [Shared CLI/MCP and workflow proposal](../proposals/customizable-engineering-workflows.md) |
| W-007 · Review evidence in one place | [Read the spec](W-007-evidence-and-custom-workflows/spec.md) | Evidence beside the spec |
| W-006 · Trustworthy autonomous coding | [Read the proposal](W-006-trustworthy-autonomous-coding/spec.md) | [Initial review evidence](W-006-trustworthy-autonomous-coding/review-notes.md) — historical observations, not another spec |
| W-005 · Consumer CLI, npm publish, sealed plan digests | [Read the spec](consumer-cli-and-npm-publish.md) | Formal reviews in [the ledger](../../.spec-ledger/reviews/workstreams/W-005/) |

## Earlier work

| Workstream | Main spec |
| --- | --- |
| W-004 · Spec and code stay coupled | [Read the spec](spec-code-coupling-and-honest-lattice-trail.md) |
| W-003 · Spec Ledger in the browser | [Read the spec](spec-ledger-dogfood-ui.md) |
| W-002 · Full builder runtime | [Read the spec](p0-p3-runtime-and-dogfood.md) |
| W-001 · Honest builder turns | [Read the spec](builder-episode-loop.md) |

For live status, use the UI or [workstream metadata](../../.spec-ledger/workstreams/). This index does not duplicate workflow status.

## Layout for new work

```text
docs/workstreams/
  README.md
  W-006-trustworthy-autonomous-coding/
    spec.md             # Main proposal and acceptance; read this first
    review-notes.md     # Optional supporting evidence, clearly labeled
    assets/             # Only when images or other files are needed
```

- Folder name: stable workstream ID plus a readable slug. Do not rename it for routine title changes.
- `spec.md` is the one main spec. Link supporting material from it; avoid alternate spec copies such as `spec-final-v2.md`.
- Create supporting files only when needed. They provide evidence or explanation, not a competing acceptance contract. Formal review records remain in `.spec-ledger/reviews/`.
- Shared architecture belongs in [architecture](../architecture/); standing vision belongs in [compass](../compass/). Keep workstream-specific research beside its spec.
- New work uses this layout. W-001–W-005 retain their existing sealed paths. Move sealed documents only through an explicit recorded migration; never silently rewrite snapshots or facts.

This layout supersedes the earlier flat title-slug naming convention for new workstreams. It does not retroactively amend older sealed specs.
